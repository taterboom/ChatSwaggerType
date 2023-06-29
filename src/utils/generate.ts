import { get } from "lodash"
import { fetchSSE } from "./fetchSSE"

export function generateSchema(
  json: Record<string, any>,
  paths: string | string[]
): Record<string, any> {
  const schema: Record<string, any> = Array.isArray(paths)
    ? paths.reduce((acc, cur) => acc[cur], json)
    : get(json, paths)
  console.log(json, paths, schema)
  const _generate = (_schema: Record<string, any>): Record<string, any> => {
    return Object.fromEntries(
      Object.entries(_schema)
        .map(([key, value]) => {
          if (key === "$ref") {
            const refPaths = (value as string).split("/").slice(1)
            return Object.entries(generateSchema(json, refPaths))
          }
          return [[key, typeof value === "object" ? _generate(value) : value]]
        })
        .flat()
    )
  }
  return _generate(schema)
}

type QueryConfig = {
  language: string
  schema: string
  signal?: AbortSignal
  onMessage: (data: { content: string; role: string }) => void
  onError: (error: string) => void
  onFinish: (reason: string) => void
}

export function generateMessages(query: Pick<QueryConfig, "schema" | "language">) {
  return [
    {
      role: "system",
      content: `You will act as a type definition code generator. I will provide you with a swagger schema JSON delimited by triple backticks and the target language delimited by triple quotes, you should generate the type definition code based on the schema in the language.
      Here are some points to note:
      - swagger schema keywords like 'allOf' etc. should not be considered as a type
      - if a field has a description, append the description as a comment after the filed, otherwise do not wirte any comments
      - some of the "number" types are actually "enum" types.
      Provide output inside one unique code block, and nothing else. Do not write explanations.`,
    },
    {
      role: "user",
      content: `The language is """typescript"""
      The swagger schema JSON is \`\`\`{"allOf":{"0":{"properties":{"ipp":{"example":10,"format":"int64","minimum":0,"type":"integer","x-omitempty":false},"page":{"example":1,"format":"int64","minimum":1,"type":"integer","x-omitempty":false},"total":{"example":100,"format":"int64","type":"integer","x-omitempty":false}},"type":"object"},"1":{"properties":{"objects":{"items":{"properties":{"id":{"example":"qwert","type":"string","x-omitempty":false},"status":{"description":"\`\`\`\n  状态\n  0. 未上线\n  1. 已上线\n  2. 已下线\n\`\`\`\n","enum":{"0":0,"1":1,"2":2},"type":"integer","x-go-type":"uint8"},"vocab":{"description":"单词","type":"string"}},"required":{"0":"id","1":"vocab","3":"status"},"type":"object"},"type":"array"}},"required":{"0":"objects"},"type":"object"}}}\`\`\``,
    },
    {
      role: "assistant",
      content: `\`\`\`
      type Response = {
        ipp: number,
        page: number,
        total: number,
        objects: {
          id: string,
          /**
           * 状态
           * 0. 未上线
           * 1. 已上线
           * 2. 已下线
           */
          status: 0 | 1 | 2,
          vocab: string, // 单词
        }[]
      }
      \`\`\``,
    },
    {
      role: "user",
      content: `The language is """${query.language}"""
      The swagger schema JSON is \`\`\`${query.schema}\`\`\``,
    },
  ]
}

export function generateSinglePrompt(...args: Parameters<typeof generateMessages>) {
  return `
  Here are chats. The middle part about user and assistant content is an example, please generate next assistant content.
  ${JSON.stringify(generateMessages(...args))}
  `
}

export async function generate(query: QueryConfig, apiKey: string) {
  const body: Record<string, any> = {
    model: "gpt-3.5-turbo",
    // temperature: 0,
    // max_tokens: 1000,
    // top_p: 1,
    // frequency_penalty: 1,
    // presence_penalty: 1,
    stream: true,
    messages: generateMessages(query),
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  }

  let isFirst = true

  await fetchSSE(`https://api.openai.com/v1/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: query.signal,
    onMessage: (msg) => {
      // console.log(msg)
      let resp
      try {
        resp = JSON.parse(msg)
        // eslint-disable-next-line no-empty
      } catch {
        query.onFinish("stop")
        return
      }
      const { choices } = resp
      if (!choices || choices.length === 0) {
        return { error: "No result" }
      }
      const { finish_reason: finishReason } = choices[0]
      if (finishReason) {
        query.onFinish(finishReason)
        return
      }

      let targetTxt = ""
      const { content = "", role } = choices[0].delta
      targetTxt = content

      // if (trimFirstQuotation && isFirst && targetTxt && ['“', '"', '「'].indexOf(targetTxt[0]) >= 0) {
      //     targetTxt = targetTxt.slice(1)
      // }
      // if (!role) {
      //     isFirst = false
      // }
      query.onMessage({ content: targetTxt, role })
    },
    onError: (err) => {
      const { error } = err
      query.onError(error.message)
    },
  })
}
