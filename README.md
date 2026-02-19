# Gmail MCP

This project exposes Gmail-related MCP tools and includes helper code to obtain refreshed access tokens.

## Gmail API curl examples
```bash
get email(full content) -
curl --location \
'https://gmail.googleapis.com/gmail/v1/users/me/messages/{MESSAGE_ID}?format=full' \
--header 'Authorization: Bearer <ACCESS_TOKEN>'

send email -
curl --location 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send' \
--header 'Authorization: Bearer <ACCESS_TOKEN>' \
--header 'Content-Type: application/json' \
--data '{
  "raw": "BASE64URL_ENCODED_RFC2822_EMAIL"
}'

create draft - 
curl --location 'https://gmail.googleapis.com/gmail/v1/users/me/drafts' \
--header 'Authorization: Bearer <ACCESS_TOKEN>' \
--header 'Content-Type: application/json' \
--data '{
  "message": {
    "raw": "BASE64URL_ENCODED_RFC2822_EMAIL"
  }
}'

list threads - 
curl --location \
'https://gmail.googleapis.com/gmail/v1/users/me/threads?maxResults=10' \
--header 'Authorization: Bearer <ACCESS_TOKEN>'

modify labels (archive/mark read) -
curl --location \
'https://gmail.googleapis.com/gmail/v1/users/me/messages/{MESSAGE_ID}/modify' \
--header 'Authorization: Bearer <ACCESS_TOKEN>' \
--header 'Content-Type: application/json' \
--data '{
  "removeLabelIds": ["UNREAD","INBOX"]
}'
```

## getAccessToken (refresh token helper)

This project uses an internal token service to exchange a JWT + connection identifier for a short-lived Gmail access token. The following helper (from `src/server.ts`) performs that call — it is the API this project uses to obtain refreshed tokens for MCP clients.

```ts
async function getAccessToken(jwt: string | undefined, connection: string | undefined) {
  if(!jwt || !connection) {
    throw new Error("missing jwt or connection in header");
  }
  const res = await fetch("https://curlmate.dev/api/token", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "x-connection": connection
    }
  });

  if (!res.ok) throw new Error(await res.text());
  const data = zAccessTokenResponse.parse(await res.json());
  return data.accessToken;
}
```

Notes:
- The token endpoint expects an `Authorization: Bearer <JWT>` header and an `x-connection` header that identifies which connection to refresh.
- The endpoint returns JSON of the shape: `{ accessToken: string }`.

If you want this helper extracted to a separate module or exposed as its own MCP tool, I can do that next.
# Gmail Remote MCP

This remote MCP Agent runs in wrangler and is deployed to cloudflare worker.
Tools implemented:  
 `list authenticated user`, `search emails`,

 ## Claude Desktop Config
 ```  
     "gmail": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://gmail-mcp.curlmate.workers.dev/mcp",
        "--header",
        "access-token: your Notion Access Token from https://curlmate.dev"
      ]
    }
  ```

## Instruction

```sh
npm install
npm start
```

This will start an MCP server on `http://localhost:5174/mcp`

Inside your `McpAgent`'s `init()` method, you can define resources, tools, etc:

```ts
export class MyMCP extends McpAgent<Env> {
  server = new McpServer({
    name: "Demo",
    version: "1.0.0"
  });

  async init() {
    this.server.resource("counter", "mcp://resource/counter", (uri) => {
      // ...
    });

    this.server.registerTool(
      "add",
      {
        description: "Add to the counter, stored in the MCP",
        inputSchema: { a: z.number() }
      },
      async ({ a }) => {
        // add your logic here
      }
    );
  }
}
```
# gmail-mcp
