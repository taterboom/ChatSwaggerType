import Document, { Html, Head, Main, NextScript } from "next/document"

class MyDocument extends Document {
  render() {
    return (
      <Html className="lofi">
        <Head>
          <title>ChatSwaggerType</title>
          <link rel="shortcut icon" href="./favicon.ico" />
          <meta
            name="description"
            content="Input the swagger json, select the schema path, then generate the type."
          ></meta>
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    )
  }
}

export default MyDocument
