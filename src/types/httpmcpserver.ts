export interface HttpMcpServer {
  type: "http";
  url: string;
  headers: { Authorization: string };
}
