import { request } from "../request";
import type {
  AgentListResponse,
  AgentProfileConfig,
  CreateAgentRequest,
  AgentProfileRef,
} from "../types/agents";
import type {
  MdFileInfo,
  MdFileContent,
  FileTreeNode,
} from "../types/workspace";

// Multi-agent management API
export const agentsApi = {
  // List all agents
  listAgents: () => request<AgentListResponse>("/agents"),

  // Get agent details
  getAgent: (agentId: string) =>
    request<AgentProfileConfig>(`/agents/${agentId}`),

  // Create new agent
  createAgent: (agent: CreateAgentRequest) =>
    request<AgentProfileRef>("/agents", {
      method: "POST",
      body: JSON.stringify(agent),
    }),

  // Update agent configuration
  updateAgent: (agentId: string, agent: AgentProfileConfig) =>
    request<AgentProfileConfig>(`/agents/${agentId}`, {
      method: "PUT",
      body: JSON.stringify(agent),
    }),

  // Delete agent
  deleteAgent: (agentId: string) =>
    request<{ success: boolean; agent_id: string }>(`/agents/${agentId}`, {
      method: "DELETE",
    }),

  // Agent workspace files (legacy flat list)
  listAgentFiles: (agentId: string) =>
    request<MdFileInfo[]>(`/agents/${agentId}/agent/files`),

  // Agent workspace file tree (hierarchical)
  getAgentFileTree: (agentId: string) =>
    request<FileTreeNode[]>(`/agents/${agentId}/agent/file-tree`),

  // Read file by path (supports nested files)
  readAgentFileByPath: (agentId: string, filePath: string) =>
    request<MdFileContent>(
      `/agents/${agentId}/agent/file?path=${encodeURIComponent(filePath)}`,
    ),

  // Write file by path (supports nested files)
  writeAgentFileByPath: (agentId: string, filePath: string, content: string) =>
    request<{ written: boolean; path: string }>(
      `/agents/${agentId}/agent/file?path=${encodeURIComponent(filePath)}`,
      {
        method: "PUT",
        body: JSON.stringify({ content }),
      },
    ),

  readAgentFile: (agentId: string, filename: string) =>
    request<MdFileContent>(
      `/agents/${agentId}/agent/files/${encodeURIComponent(filename)}`,
    ),

  writeAgentFile: (agentId: string, filename: string, content: string) =>
    request<{ written: boolean; filename: string }>(
      `/agents/${agentId}/agent/files/${encodeURIComponent(filename)}`,
      {
        method: "PUT",
        body: JSON.stringify({ content }),
      },
    ),

  // Agent memory files
  listAgentMemory: (agentId: string) =>
    request<MdFileInfo[]>(`/agents/${agentId}/agent/memory`),
};
