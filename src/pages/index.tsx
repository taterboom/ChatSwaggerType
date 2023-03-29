import dynamic from "next/dynamic"
import { useEffect, useState } from "react"

const App = dynamic(() => import("../components/App"), { ssr: false })

function getSwaggerJsonUrl() {
  return (
    document.querySelector(
      "#swagger-ui > section > div.swagger-ui > div:nth-child(2) > div.information-container.wrapper > section > div > div > hgroup > a"
    ) as HTMLAnchorElement
  )?.href
}

function getHash() {
  return window.location.hash
}

const isExtension = () =>
  Boolean(typeof window !== "undefined" && window.chrome && chrome.runtime && chrome.runtime.id)

function Loading() {
  return (
    <div className="fixed inset-0 flex justify-center items-center">
      <div className="btn btn-ghost loading"></div>
    </div>
  )
}

export default function Page() {
  const [swaggerJsonStr, setSwaggerJsonStr] = useState("")
  const [pathStr, setPathStr] = useState("")
  const [loading, setLoading] = useState(() => isExtension())
  useEffect(() => {
    const init = async () => {
      try {
        if (isExtension()) {
          // Code running in a Chrome extension (content script, background page, etc.)
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
          console.log("tab", tab)
          if (!tab?.id) return
          const [[jsonResult], [hashResult]] = await Promise.all([
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: getSwaggerJsonUrl,
            }),
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: getHash,
            }),
          ])
          console.log("jsonResult", jsonResult, hashResult)
          if (!jsonResult.result) return
          const jsonStr = await fetch(jsonResult.result).then((res) => res.text())
          const operationId = hashResult.result.split("/").pop()
          const config = JSON.parse(jsonStr)
          let path = ""
          Object.keys(config.paths).forEach((p) => {
            Object.keys(config.paths[p]).forEach((method) => {
              if (config.paths[p][method].operationId === operationId) {
                if (config.paths[p][method]?.["responses"]?.[200]?.["schema"]) {
                  path = ["paths", p, method, "responses", 200, "schema"]
                    .map((item) => `["${item}"]`)
                    .join("")
                }
                if (
                  config.paths[p][method]?.["responses"]?.[200]?.["content"]?.[
                    "application/json"
                  ]?.["schema"]
                ) {
                  path = [
                    "paths",
                    p,
                    method,
                    "responses",
                    200,
                    "content",
                    "application/json",
                    "schema",
                  ]
                    .map((item) => `["${item}"]`)
                    .join("")
                }
              }
            })
          })
          setPathStr(path)
          setSwaggerJsonStr(jsonStr)
        }
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])
  console.log("path", pathStr, swaggerJsonStr)
  if (loading) return <Loading />
  return <App initialPathStr={pathStr} initialSwaggerJson={swaggerJsonStr}></App>
}
