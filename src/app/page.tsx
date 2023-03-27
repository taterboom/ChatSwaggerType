"use client"
import React, { useEffect, useMemo, useState } from "react"
import TreeView, { INode, flattenTree } from "react-accessible-treeview"
import cx from "classnames"
import { generate } from "@/utils/generate"
import ReactMarkdown from "react-markdown"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { vs } from "react-syntax-highlighter/dist/esm/styles/prism"
import { CopyToClipboard } from "react-copy-to-clipboard"
import { CarbonCaretRight } from "@/components/icons"

let copiedTimeout: any

const LANGUAGES = ["typescript", "swift", "java", "kotlin", "python", "go"]

type TreeNode = {
  name: string
  children?: TreeNode[]
}

function json2Tree(json?: Record<string, any>): TreeNode[] {
  if (typeof json !== "object") return []
  return Object.keys(json).map((key) => ({
    name: key,
    children: json2Tree(json[key]),
  }))
}

function getPath(node: INode, tree: Array<INode>): Array<any> {
  const path = []
  let currentNode: INode | undefined = node
  while (currentNode) {
    path.unshift(currentNode)
    if (currentNode.parent !== 0) {
      let parentNode = tree.find((x: any) => x.id === currentNode!.parent)
      currentNode = parentNode
    } else {
      currentNode = undefined
    }
  }
  return path
}

const GET200PATH = ["get", "responses", "200", "content", "application/json", "schema"]
const GET200PATH_PREFIX = ["paths"]

function filterJsonOnlyGET200(json: Record<string, any>) {
  const paths = json["paths"]
  return Object.fromEntries(
    Object.keys(paths)
      .filter((key) => {
        return GET200PATH.reduce((result, p) => {
          return result && result[p]
        }, paths[key])
      })
      .map((key) => [key, "placeholder"])
  )
}

const useLocalstorageState = (key: string, defaultValue?: any) => {
  const [state, setState] = useState(() => {
    if (typeof window !== "undefined") {
      const valueInLocalStorage = localStorage.getItem(key)
      if (valueInLocalStorage) {
        return valueInLocalStorage
      }
    }
    return typeof defaultValue === "function" ? defaultValue() : defaultValue
  })

  useEffect(() => {
    localStorage.setItem(key, state)
  }, [key, state])

  return [state, setState]
}

function ControlledExpandedNode() {
  const [schema, setSchema] = useState<string>("")
  // const [data, setData] = useState<null | INode[]>(null)
  const [path, setPath] = useState<Array<INode>>([])
  const [typeStr, setTypeStr] = useState("")
  const [copied, setCopied] = useState(false)
  const [onlyGet200, setOnlyGet200] = useState(false)
  const [language, setLanguage] = useState(LANGUAGES[0])
  const [loading, setLoading] = useState(false)
  const [apikey, setApikey] = useLocalstorageState("chat-swagger-type-api-key", "")

  const data = useMemo(() => {
    try {
      let schemaJson = JSON.parse(schema)
      if (onlyGet200) {
        schemaJson = filterJsonOnlyGET200(schemaJson)
      }
      return flattenTree({ name: "root", children: json2Tree(schemaJson) })
    } catch {
      return null
    }
  }, [onlyGet200, schema])

  const pathStr = useMemo(() => {
    if (path.length === 0) return ""
    const pathArr = path.map((p) => p.name)
    const paths = onlyGet200 ? [...GET200PATH_PREFIX, ...pathArr, ...GET200PATH] : pathArr
    return paths.map((n) => `["${n}"]`).join("")
  }, [onlyGet200, path])

  const generateType = async () => {
    console.log({ schema: schema, path: pathStr, language })
    if (loading) return
    if (!schema) {
      alert("Please type the swagger json")
      return
    }
    if (!pathStr) {
      alert("Please select the path")
      return
    }
    if (!apikey) {
      alert("Please input you api key")
      return
    }
    setTypeStr("")
    setLoading(true)
    try {
      await generate(
        {
          language: language,
          schema: schema,
          path: pathStr,
          onMessage: (message) => {
            if (message.role) {
              return
            }
            setTypeStr((v) => {
              return v + message.content
            })
          },
          onFinish: (reason) => {
            console.log("of", reason)
          },
          onError: (error) => {
            console.error("oe", error)
          },
        },
        apikey
      )
    } catch (error: any) {
      console.error("catch", error)
    } finally {
      console.log("finally")
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto pb-8 py-4 px-4 space-y-4">
      <h1 className="title">ChatSwaggerType</h1>
      <div className="flex gap-4 min-h-[300px]">
        <div className="flex-1">
          <textarea
            className="textarea textarea-bordered w-full h-full"
            placeholder="type swagger json here"
            onChange={(e) => {
              setSchema(e.target.value)
            }}
          ></textarea>
        </div>
        <div className="flex-1 border border-black/20">
          <div className="flex justify-between items-center border-b border-black/20 px-2">
            <div className="text-sm font-semibold">
              Select the path (end with the `schema` filed)
            </div>
            <label className="label cursor-pointer justify-start gap-2">
              <input
                className="checkbox checkbox-xs"
                type="checkbox"
                checked={onlyGet200}
                onChange={(e) => setOnlyGet200(e.target.checked)}
              />
              <span className="label-text">only GET/200</span>
            </label>
          </div>
          {data && (
            <TreeView
              className="px-2 py-1"
              data={data}
              aria-label="Controlled expanded node tree"
              defaultExpandedIds={[1]}
              onExpand={console.log}
              onSelect={(...args) => console.log(args)}
              nodeRenderer={({
                element,
                isBranch,
                isExpanded,
                isDisabled,
                getNodeProps,
                level,
                handleExpand,
              }) => {
                return (
                  <div
                    {...getNodeProps({
                      onClick: (...args) => {
                        setPath(getPath(element, data))
                        return handleExpand(...args)
                      },
                    })}
                    style={{
                      marginLeft: 36 * (level - 1),
                      opacity: isDisabled ? 0.5 : 1,
                      background: element.id === path[path.length - 1]?.id ? "#eee" : "transparent",
                    }}
                  >
                    {isBranch && <ArrowIcon isOpen={isExpanded} />}
                    <span className="name">{element.name}</span>
                  </div>
                )
              }}
            />
          )}
        </div>
      </div>
      <div className="space-x-2">
        <strong>Path: </strong> {pathStr}
      </div>
      <div className="space-x-2">
        <strong>Language: </strong>
        <select
          className="select select-bordered select-sm w-full max-w-[128px]"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
        >
          {LANGUAGES.map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
      </div>
      <div className="space-x-2">
        <strong>Api Key:</strong>
        <input
          type="text"
          placeholder="Get you api key from opanai's dashboard"
          className="input input-bordered input-sm w-full max-w-xs"
          value={apikey}
          onChange={(e) => setApikey(e.target.value)}
        />
      </div>
      <button className={cx("btn btn-sm btn-primary", loading && "loading")} onClick={generateType}>
        generate
      </button>
      {typeStr ? (
        <section className="response">
          <ReactMarkdown
            components={{
              code({ node, inline, className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || "")
                const lan = match ? match[1] : language
                return !inline ? (
                  <div>
                    <div className="flex justify-between bg-white text-base-[#999] py-1 px-4 border border-[#ddd] border-b-0 text-xs">
                      <div className="">{lan}</div>
                      <CopyToClipboard
                        text={String(children)}
                        onCopy={() => {
                          if (copiedTimeout) {
                            clearTimeout(copiedTimeout)
                          }
                          setCopied(true)
                          copiedTimeout = setTimeout(() => {
                            setCopied(false)
                          }, 1500)
                        }}
                      >
                        <button className="">{copied ? "copied" : "copy"}</button>
                      </CopyToClipboard>
                    </div>
                    <SyntaxHighlighter
                      // @ts-ignore
                      style={vs}
                      customStyle={{ margin: 0 }}
                      language={lan}
                      PreTag="div"
                      {...props}
                    >
                      {String(children).replace(/\n$/, "")}
                    </SyntaxHighlighter>
                  </div>
                ) : (
                  <code className={className} {...props}>
                    {children}
                  </code>
                )
              },
            }}
          >
            {typeStr}
          </ReactMarkdown>
        </section>
      ) : null}
    </div>
  )
}

const ArrowIcon = (props: { isOpen: boolean; className?: string }) => {
  return (
    <CarbonCaretRight
      className={cx("inline-block transition-transform", props.isOpen && "rotate-90")}
    />
  )
}

export default ControlledExpandedNode
