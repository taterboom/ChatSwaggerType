"use client"
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import TreeView, { INode, flattenTree } from "react-accessible-treeview"
import cx from "classnames"
import { generate, generateMessages, generateSchema } from "@/utils/generate"
import ReactMarkdown from "react-markdown"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { vs } from "react-syntax-highlighter/dist/esm/styles/prism"
import { CopyToClipboard } from "react-copy-to-clipboard"
import copy from "copy-to-clipboard"
import { CarbonCaretRight } from "@/components/icons"
import TextareaAutosize from "react-textarea-autosize"

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
const GET200PATH_VARIENT_0 = ["get", "responses", "200", "content", "application/json", "schema"]
const GET200PATH_VARIENT_1 = ["get", "responses", "200", "schema"]
const GET200PATH_PREFIX = ["paths"]
const PATH_SPLITTER = "~~~"
function filterJsonOnlyGET200(json?: Record<string, any>) {
  const paths = json?.["paths"]
  if (!paths) return
  return Object.fromEntries(
    Object.keys(paths)
      .map((key) => {
        const path = paths[key]
        if (
          GET200PATH_VARIENT_0.reduce((result, p) => {
            return result && result[p]
          }, path)
        ) {
          return [key, GET200PATH_VARIENT_0.join(PATH_SPLITTER)]
        }
        if (
          GET200PATH_VARIENT_1.reduce((result, p) => {
            return result && result[p]
          }, path)
        ) {
          return [key, GET200PATH_VARIENT_1.join(PATH_SPLITTER)]
        }
        return [key, null]
      })
      .filter((x) => x[1] !== null)
  )
}

const useLocalstorageState = (key: string, defaultValue?: any) => {
  const [state, setState] = useState(() => {
    if (typeof window !== "undefined") {
      const valueInLocalStorage = localStorage.getItem(key)
      if (valueInLocalStorage) {
        if (valueInLocalStorage === "true") return true
        if (valueInLocalStorage === "false") return false
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

function useFirstMountState(): boolean {
  const isFirst = useRef(true)

  if (isFirst.current) {
    isFirst.current = false

    return true
  }

  return isFirst.current
}

function CopyPrompt(props: { copy: () => boolean }) {
  const [copied, setCopied] = useState(false)
  const copiedTimeoutRef = useRef<any>()
  const onCopy = () => {
    if (props.copy()) {
      setCopied(true)
      clearTimeout(copiedTimeoutRef.current)
      copiedTimeoutRef.current = setTimeout(() => {
        setCopied(false)
      }, 1500)
    }
  }
  return (
    <span
      className="cursor-pointer opacity-50 transition-opacity hover:opacity-100"
      onClick={onCopy}
    >
      copy the prompt {copied ? "✅" : ""}
    </span>
  )
}

function App(props: { initialSwaggerJson?: string; initialPathStr?: string }) {
  const [schema, setSchema] = useState<string>(props.initialSwaggerJson || "")
  const [path, setPath] = useState<Array<INode>>([])
  const [typeStr, setTypeStr] = useState("")
  const [copied, setCopied] = useState(false)
  const [onlyGet200, setOnlyGet200] = useLocalstorageState("chat-swagger-type-only-get-200", false)
  const [language, setLanguage] = useLocalstorageState("chat-swagger-type-language", LANGUAGES[0])
  const [loading, setLoading] = useState(false)
  const [apikey, setApikey] = useLocalstorageState("chat-swagger-type-api-key", "")
  const [pathStr, setPathStr] = useState(props.initialPathStr || "")

  const firstMounted = useFirstMountState()

  const originSchemaJson = useMemo(() => {
    try {
      return JSON.parse(schema)
    } catch {
      return null
    }
  }, [schema])

  const schemaJson = useMemo(() => {
    if (onlyGet200) {
      return filterJsonOnlyGET200(originSchemaJson)
    }
    return originSchemaJson
  }, [onlyGet200, originSchemaJson])

  const data = useMemo(() => {
    try {
      return flattenTree({ name: "root", children: json2Tree(schemaJson) })
    } catch {
      return null
    }
  }, [schemaJson])

  const getPathStr = useCallback(() => {
    if (path.length === 0) return ""
    const pathArr = path.map((p) => p.name)
    const paths = onlyGet200
      ? [...GET200PATH_PREFIX, pathArr[0], ...schemaJson![pathArr[0]].split(PATH_SPLITTER)]
      : pathArr
    return paths.map((n) => `["${n}"]`).join("")
  }, [onlyGet200, path, schemaJson])

  useEffect(() => {
    if (!firstMounted) {
      setPathStr(getPathStr())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getPathStr])

  const checkValid = (forceApiKey = false) => {
    if (!schema) {
      alert("Please type the swagger json")
      return false
    }
    if (!pathStr) {
      alert("Please select the path")
      return false
    }
    if (forceApiKey && !apikey) {
      alert("Please input you api key")
      return false
    }
    return true
  }

  const generateType = async () => {
    if (loading) return
    if (!checkValid(true)) {
      return
    }
    setTypeStr("")
    setLoading(true)
    try {
      await generate(
        {
          language: language,
          schema: JSON.stringify(generateSchema(originSchemaJson, pathStr)),
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

  const copyPrompt = () => {
    if (!checkValid()) {
      return false
    }
    copy(
      generateMessages({
        language,
        schema: JSON.stringify(generateSchema(originSchemaJson, pathStr)),
      })
        .map((item) => item.content)
        .join("\n")
    )
    return true
  }

  return (
    <div className="container mx-auto pb-8 py-4 px-4 space-y-4">
      <div className="logo md:block">
        <h1 className="title">ChatSwaggerType</h1>
        <h2 className="tips">
          Input the swagger json, select the schema path, then generate the type.
        </h2>
      </div>
      <div className="flex gap-4 min-h-[300px] md:block md:space-y-2">
        <div className="flex-1">
          <textarea
            className="textarea textarea-bordered w-full h-full min-h-[100px] md:text-xs py-1 px-2"
            placeholder="type swagger json here"
            value={schema}
            onChange={(e) => {
              setSchema(e.target.value)
            }}
          ></textarea>
        </div>
        <div className="flex-1 border border-black/20 min-h-[180px]">
          <div className="flex justify-between items-center border-b border-black/20 px-2">
            <div className="text-sm font-semibold">
              Select the path (end with the `schema` filed)
            </div>
            <label className="label cursor-pointer justify-start gap-2">
              <input
                className="checkbox checkbox-xs"
                type="checkbox"
                checked={onlyGet200}
                onChange={(e) => {
                  setPath([])
                  setOnlyGet200(e.target.checked)
                }}
              />
              <span className="label-text">only GET/200</span>
            </label>
          </div>
          {data && (
            <TreeView
              className="px-2 py-1"
              data={data}
              aria-label="Controlled expanded node tree"
              // defaultExpandedIds={[1]}
              // onExpand={console.log}
              // onSelect={(...args) => console.log(args)}
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
      <div className="flex space-x-2">
        <strong>Path: </strong>{" "}
        <TextareaAutosize
          className="flex-1 textarea textarea-ghost py-0 px-1 align-top min-h-6 resize-none -mt-0.5 md:-mt-1"
          placeholder="Select the path or type here"
          value={pathStr}
          onChange={(e) => {
            setPathStr(e.target.value)
          }}
        ></TextareaAutosize>
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
        Generate
      </button>
      <span className="text-xs ml-2">
        <span className="opacity-50">or </span>
        <CopyPrompt copy={copyPrompt} />
      </span>
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
export default App
