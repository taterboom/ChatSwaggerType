import { fetchSSE } from "./fetchSSE"

type QueryConfig = {
  language: string
  schema: string
  path: string
  signal?: AbortSignal
  onMessage: (data: { content: string; role: string }) => void
  onError: (error: string) => void
  onFinish: (reason: string) => void
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
    messages: [
      {
        role: "user",
        content: `This is a swagger schema json. ${query.schema}`,
      },
      {
        role: "user",
        content: `generate ${query.language} definition at path "${query.path}", note that some \`number\` types are \`enum\`.`,
      },
    ],
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  }

  let isFirst = true

  // console.log(body)
  // return

  await fetchSSE(`https://api.openai.com/v1/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: query.signal,
    onMessage: (msg) => {
      console.log(msg)
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
