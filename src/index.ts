#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequest,
  CallToolRequestSchema,
  CallToolResult,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import alphavantage from "alphavantage";

const apiKey = process.env.ALPHA_VANTAGE_API_KEY;

if (!apiKey) {
  console.error("ALPHA_VANTAGE_API_KEY environment variable not set.");
  process.exit(1);
}

const alpha = alphavantage({ key: apiKey });

interface GetHistoricalDataInput {
  symbol: string;
  interval?: "daily" | "weekly" | "monthly";
  outputsize?: "compact" | "full";
}

const getStockQuoteTool: Tool = {
  name: "getStockQuote",
  description: "Get the current quote for a stock.",
  inputSchema: {
    type: "object",
    properties: {
      symbol: {
        type: "string",
        description: "The stock symbol (e.g., AAPL)",
      },
    },
    required: ["symbol"],
  },
};

const getHistoricalDataTool: Tool = {
  name: "getHistoricalData",
  description: "Get historical data for a stock.",
  inputSchema: {
    type: "object",
    properties: {
      symbol: {
        type: "string",
        description: "The stock symbol (e.g., AAPL)",
      },
      interval: {
        type: "string",
        description:
          "The time interval for the data (daily, weekly, or monthly)",
        default: "daily",
      },
      outputsize: {
        type: "string",
        description: "The size of the output (compact or full)",
        default: "compact",
      },
    },
    required: ["symbol"],
  },
};

const server = new Server(
  {
    name: "findata-mcp-server",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [getStockQuoteTool, getHistoricalDataTool],
}));

server.setRequestHandler(
  CallToolRequestSchema,
  async (request: CallToolRequest) => {
    if (request.params.name === "getStockQuote") {
      try {
        const input = request.params.arguments as unknown as GetHistoricalDataInput;
        const symbol = input.symbol;
        const data = await alpha.data.quote(symbol); // Correct usage
        const result: CallToolResult = {
          content: [
            {
              type: "text",
              text: JSON.stringify(data),
            },
          ],
        };
        return result;
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error: ${error}` }],
          isError: true,
        };
      }
    } else if (request.params.name === "getHistoricalData") {
      try {
        const input = request.params.arguments as unknown as GetHistoricalDataInput;

        const symbol = input.symbol;
        const interval = input.interval || "daily";
        const outputsize = input.outputsize || "compact";

        let data;
        switch (interval) {
          case "daily":
            data = await alpha.data.daily(symbol, outputsize);
            break;
          case "weekly":
            data = await alpha.data.weekly(symbol);
            break;
          case "monthly":
            data = await alpha.data.monthly(symbol);
            break;
          default:
            return {
              content: [
                {
                  type: "text",
                  text: "Invalid interval. Please specify 'daily', 'weekly', or 'monthly'.",
                },
              ],
              isError: true,
            };
        }

        const result: CallToolResult = {
          content: [{ type: "text", text: JSON.stringify(data) }],
        };
        return result;
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error: ${error}` }],
          isError: true,
        };
      }
    } else {
      return {
        content: [{ type: "text", text: "Unknown tool" }],
        isError: true,
      };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
