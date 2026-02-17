import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { z } from "zod";

const zAccessTokenResponse = z.object({
  accessToken: z.string(),
})

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

export class GmailMCP extends McpAgent<Env, {}> {
  server = new McpServer({
    name: "gmail-mcp",
    version: "0.0.1",
  });

  async init() {
    this.server.registerTool(
      "search-emails",
      {
        description: "this tool lists all emails matching search query",
        inputSchema: { 
          q: z.string()
        }
      },
      async ({ q }, { requestInfo }) => {
        const jwt = requestInfo?.headers["access-token"] as string | undefined;
        const connection = requestInfo?.headers["x-connection"] as string | undefined;
        const accessToken = await getAccessToken(jwt, connection);
        const params = new URLSearchParams();
        params.set("q", q )
        const response = await fetch(`https://www.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          }
        })

        if (!response.ok) {
          return {
            content: [
              {
                text: JSON.stringify(await response.text()),
                type: "text"
              }
            ]
          }
        }

        return {
          content: [
            {
              text: JSON.stringify(await response.json()),
              type: "text"
            }
          ]
        };
      }
    );
    this.server.registerTool(
      "authenticated-user",
      {
        description: "this tool lists the authenticated user",
        inputSchema: { }
      },
      async ({}, { requestInfo }) => {
        const jwt = requestInfo?.headers["access-token"] as string | undefined;
        const connection = requestInfo?.headers["x-connection"] as string | undefined;
        const accessToken = await getAccessToken(jwt, connection);
        const response = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          }
        })

        if (!response.ok) {
          return {
            content: [
              {
                text: JSON.stringify(await response.text()),
                type: "text"
              }
            ]
          }
        }

        return {
          content: [
            {
              text: JSON.stringify(await response.json()),
              type: "text"
            }
          ]
        };
      }
    );
  }

  onError(_: unknown, error?: unknown): void | Promise<void> {
    console.error("GmailMCP initialization error:", error);
  }
}

export default {
  fetch(request: Request, env: unknown, ctx: ExecutionContext) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/sse")) {
      return GmailMCP.serveSSE("/sse", { binding: "GmailMCP" }).fetch(
        request,
        env,
        ctx
      );
    }

    if (url.pathname.startsWith("/mcp")) {
      return GmailMCP.serve("/mcp", { binding: "GmailMCP" }).fetch(request, env, ctx);
    }

    return new Response("Not found", { status: 404 });
  }
};
