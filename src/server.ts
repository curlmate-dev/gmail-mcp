import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { z } from "zod";

const zAccessTokenResponse = z.object({
  accessToken: z.string(),
})

const CURLMATE_BASE_URL = "https://api.curlmate.dev/token";

async function getAccessToken(jwt: string | undefined, connection: string | undefined) {
  if(!jwt || !connection) {
    throw new Error("missing jwt or connection in header");
  }
  const res = await fetch(CURLMATE_BASE_URL, {
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

function buildRfc2822(headers: Record<string, string>, body: string) {
  const headerLines = Object.entries(headers).map(([k, v]) => `${k}: ${v}`);
  return headerLines.join('\r\n') + '\r\n\r\n' + body;
}

function base64UrlEncode(str: string) {
  const replace = (s: string) => s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const anyGlobal: any = globalThis as any;
  if (anyGlobal.Buffer && typeof anyGlobal.Buffer.from === 'function') {
    return replace(anyGlobal.Buffer.from(str).toString('base64'));
  }

  if (typeof anyGlobal.btoa === 'function') {
    return replace(anyGlobal.btoa(unescape(encodeURIComponent(str))));
  }

  throw new Error('No base64 encoder available in this environment');
}

export class GmailMCP extends McpAgent<Env, {}> {
  server = new McpServer({
    name: "gmail-mcp",
    version: "0.0.1",
  });

  async init() {
    this.server.registerTool(
      "get-email-full-content",
      {
        description: "this tool gets the full content of an email by id",
        inputSchema: {
          messageId: z.string(),
        }
      },
      async ({ messageId }, { requestInfo }) => {
        const jwt = requestInfo?.headers["access-token"] as string | undefined;
        const connection = requestInfo?.headers["x-connection"] as string | undefined;
        const accessToken = await getAccessToken(jwt, connection);
        const response = await fetch(`https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`, {
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
    )
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
    this.server.registerTool(
      "send-email",
      {
        description: "send an email using a raw base64url RFC2822 message",
        inputSchema: {
          raw: z.string(),
        }
      },
      async ({ raw }, { requestInfo }) => {
        const jwt = requestInfo?.headers["access-token"] as string | undefined;
        const connection = requestInfo?.headers["x-connection"] as string | undefined;
        const accessToken = await getAccessToken(jwt, connection);

        const response = await fetch(`https://www.googleapis.com/gmail/v1/users/me/messages/send`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ raw })
        });

        if (!response.ok) {
          return {
            content: [
              { text: JSON.stringify(await response.text()), type: "text" }
            ]
          };
        }

        return {
          content: [
            { text: JSON.stringify(await response.json()), type: "text" }
          ]
        };
      }
    );
    this.server.registerTool(
      "create-draft",
      {
        description: "create a draft with a raw base64url RFC2822 message",
        inputSchema: {
          raw: z.string(),
        }
      },
      async ({ raw }, { requestInfo }) => {
        const jwt = requestInfo?.headers["access-token"] as string | undefined;
        const connection = requestInfo?.headers["x-connection"] as string | undefined;
        const accessToken = await getAccessToken(jwt, connection);

        const response = await fetch(`https://www.googleapis.com/gmail/v1/users/me/drafts`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ message: { raw } })
        });

        if (!response.ok) {
          return {
            content: [
              { text: JSON.stringify(await response.text()), type: "text" }
            ]
          };
        }

        return {
          content: [
            { text: JSON.stringify(await response.json()), type: "text" }
          ]
        };
      }
    );
    this.server.registerTool(
      "list-threads",
      {
        description: "list threads for the authenticated user",
        inputSchema: {
          maxResults: z.number().optional(),
        }
      },
      async ({ maxResults }, { requestInfo }) => {
        const jwt = requestInfo?.headers["access-token"] as string | undefined;
        const connection = requestInfo?.headers["x-connection"] as string | undefined;
        const accessToken = await getAccessToken(jwt, connection);
        const params = new URLSearchParams();
        if (typeof maxResults === "number") params.set("maxResults", String(maxResults));

        const response = await fetch(`https://www.googleapis.com/gmail/v1/users/me/threads?${params.toString()}`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          }
        });

        if (!response.ok) {
          return { content: [ { text: JSON.stringify(await response.text()), type: "text" } ] };
        }

        return { content: [ { text: JSON.stringify(await response.json()), type: "text" } ] };
      }
    );
    this.server.registerTool(
      "modify-labels",
      {
        description: "modify labels on a message (archive/mark read)",
        inputSchema: {
          messageId: z.string(),
          removeLabelIds: z.array(z.string()).optional(),
          addLabelIds: z.array(z.string()).optional(),
        }
      },
      async ({ messageId, removeLabelIds, addLabelIds }, { requestInfo }) => {
        const jwt = requestInfo?.headers["access-token"] as string | undefined;
        const connection = requestInfo?.headers["x-connection"] as string | undefined;
        const accessToken = await getAccessToken(jwt, connection);

        const body: any = {};
        if (removeLabelIds) body.removeLabelIds = removeLabelIds;
        if (addLabelIds) body.addLabelIds = addLabelIds;

        const response = await fetch(`https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body)
        });

        if (!response.ok) {
          return { content: [ { text: JSON.stringify(await response.text()), type: "text" } ] };
        }

        return { content: [ { text: JSON.stringify(await response.json()), type: "text" } ] };
      }
    );
    this.server.registerTool(
      "compose-and-send",
      {
        description: "compose an RFC2822 message, base64url-encode it, and send via Gmail (example for MCP clients)",
        inputSchema: {
          from: z.string(),
          to: z.string(),
          subject: z.string(),
          body: z.string(),
          cc: z.string().optional(),
          bcc: z.string().optional(),
          isHtml: z.boolean().optional(),
        }
      },
      async ({ from, to, subject, body, cc, bcc, isHtml }, { requestInfo }) => {
        const jwt = requestInfo?.headers["access-token"] as string | undefined;
        const connection = requestInfo?.headers["x-connection"] as string | undefined;
        const accessToken = await getAccessToken(jwt, connection);

        const headers: Record<string, string> = {
          From: from,
          To: to,
          Subject: subject,
          'MIME-Version': '1.0',
          Date: new Date().toUTCString(),
          'Content-Transfer-Encoding': '7bit',
        };
        if (cc) headers['Cc'] = cc;
        if (bcc) headers['Bcc'] = bcc;
        if (isHtml) headers['Content-Type'] = 'text/html; charset="UTF-8"';
        else headers['Content-Type'] = 'text/plain; charset="UTF-8"';

        const rfc = buildRfc2822(headers, body);
        const raw = base64UrlEncode(rfc);

        const response = await fetch(`https://www.googleapis.com/gmail/v1/users/me/messages/send`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ raw })
        });

        if (!response.ok) {
          return { content: [ { type: 'text', text: JSON.stringify(await response.text()) } ] };
        }

        const respJson = await response.json();
        return {
          content: [
            { type: 'text', text: JSON.stringify({ raw, sent: respJson }) }
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
