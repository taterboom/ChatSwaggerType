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
    // {
    //   role: "user",
    //   content: `This is a swagger schema json. ${query.schema}`,
    // },
    // {
    //   role: "user",
    //   content: `Generate ${query.language} definition at path \`${query.path}\` in the swagger schema json, note that some \`number\` types are \`enum\`. The result should be placed in a code block in markdown format. Do not generate definition at other paths.`,
    // },
    {
      role: "system",
      content: `I want you to act as a code type definition generator. I will give you a swagger schema json, you should give me the definition in ${query.language}, you should add comment from the \`description\` filed if exists, note that some of the "number" types are actually "enum" types. I want you to only reply with the definition inside one unique code block, and nothing else. do not write explanations.`,
    },
    {
      role: "user",
      content: `The swagger schema json is \`${query.schema}\``,
    },
  ]
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
