# ChatSwaggerType

Input the swagger json, select the schema path, then generate the type.

[watch Demo](https://youtu.be/cEcj7AVXi_E)

## Usage

提前安装好 [Chrome 扩展](https://chrome.google.com/webstore/detail/chatswaggertype/lkminimpgnlpggmkanlhiahjafjnllfk)

1. 点击某一条 GET API
2. 点击 ChatSwaggerType 扩展图标
3. ChatSwaggerType 会识别当前页面的接口信息，并默认选中之前点击的那一条接口
4. 选择语言，输入 API KEY
5. 点击生成，或者点击“copy the prompt”粘贴至 ChatGPT 对话框。

## Tech

1. 根据 `API Path` 从 `Swagger Schema JSON` 中提取类型定义信息
2. 根据用户选择生成 `Prompt` （in `src/utils/generate.ts` ）
3. 使用 `ChatGPT API` 生成类型定义代码（or copy the Prompt）
