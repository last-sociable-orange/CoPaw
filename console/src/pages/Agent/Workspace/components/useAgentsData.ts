import { useState, useEffect, useCallback } from "react";
import { message } from "@agentscope-ai/design";
import { useTranslation } from "react-i18next";
import api from "../../../../api";
import type { FileTreeNode, DailyMemoryFile } from "../../../../api/types";
import { workspaceApi } from "../../../../api/modules/workspace";
import { agentsApi } from "../../../../api/modules/agents";
import { useAgentStore } from "../../../../stores/agentStore";

// Flatten tree to list of file paths (for enabled files ordering)
const flattenFilePaths = (nodes: FileTreeNode[]): string[] => {
  const paths: string[] = [];
  for (const node of nodes) {
    if (node.type === "file") {
      paths.push(node.path);
    } else if (node.children) {
      paths.push(...flattenFilePaths(node.children));
    }
  }
  return paths;
};

// Find a node by path in the tree
const findNodeByPath = (
  nodes: FileTreeNode[],
  path: string,
): FileTreeNode | null => {
  for (const node of nodes) {
    if (node.path === path) {
      return node;
    }
    if (node.children) {
      const found = findNodeByPath(node.children, path);
      if (found) return found;
    }
  }
  return null;
};

// Convert FileTreeNode to a file-like object for selection
const nodeToSelectedFile = (node: FileTreeNode) => ({
  filename: node.name,
  path: node.path,
  size: node.size,
  created_time: node.modified_time,
  modified_time: node.modified_time,
  updated_at: new Date(node.modified_time).getTime(),
});

export const useAgentsData = () => {
  const { t } = useTranslation();
  const { selectedAgent } = useAgentStore();
  const [fileTree, setFileTree] = useState<FileTreeNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<
    ReturnType<typeof nodeToSelectedFile> | null
  >(null);
  const [dailyMemories, setDailyMemories] = useState<DailyMemoryFile[]>([]);
  const [expandedMemory, setExpandedMemory] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(),
  );
  const [fileContent, setFileContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);
  const [enabledFiles, setEnabledFiles] = useState<string[]>([]);

  // Initialize expanded folders with common directories
  useEffect(() => {
    setExpandedFolders(new Set(["skills", "memory"]));
  }, [selectedAgent]);

  const fetchEnabledFiles = useCallback(async () => {
    try {
      const result = await workspaceApi.getSystemPromptFiles();
      const enabled = Array.isArray(result) ? result : [];
      setEnabledFiles(enabled);
      return enabled;
    } catch (error) {
      console.error("Failed to fetch enabled files", error);
      return [];
    }
  }, []);

  const fetchFileTree = useCallback(
    async (latestEnabledFiles?: string[]) => {
      try {
        // Fetch enabled files if not provided
        if (!Array.isArray(latestEnabledFiles)) {
          await fetchEnabledFiles();
        }
        const tree = await agentsApi.getAgentFileTree(selectedAgent);
        setFileTree(tree);

        // Set workspace path from first file if available
        if (tree.length > 0) {
          const firstFile = flattenFilePaths(tree)[0];
          if (firstFile) {
            const parts = firstFile.split("/");
            parts.pop();
            setWorkspacePath(parts.join("/") || ".");
          }
        } else {
          setWorkspacePath("");
        }
      } catch (error) {
        console.error("Failed to fetch file tree", error);
        message.error("Failed to load file tree");
      }
    },
    [selectedAgent, fetchEnabledFiles],
  );

  useEffect(() => {
    const initializeData = async () => {
      // Remember currently selected file path
      const previouslySelectedPath = selectedFile?.path;

      // Clear content first
      setFileContent("");
      setOriginalContent("");
      setExpandedMemory(false);

      await fetchEnabledFiles();
      const tree = await agentsApi.getAgentFileTree(selectedAgent);
      setFileTree(tree);

      // Set workspace path (handle both Unix '/' and Windows '\\' separators)
      if (tree.length > 0) {
        const firstFile = flattenFilePaths(tree)[0];
        if (firstFile) {
          const parts = firstFile.split("/");
          parts.pop();
          setWorkspacePath(parts.join("/") || ".");
        }
      } else {
        setWorkspacePath("");
      }

      // Try to re-select the same file in new workspace
      if (previouslySelectedPath) {
        const node = findNodeByPath(tree, previouslySelectedPath);
        if (node && node.type === "file") {
          // Auto-load the same file from new workspace
          await handleFileNodeClick(node);
        } else {
          // File doesn't exist in new workspace, clear selection
          setSelectedFile(null);
        }
      } else {
        setSelectedFile(null);
      }
    };
    initializeData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAgent]);

  const fetchDailyMemories = async () => {
    try {
      const memoryList = await api.listDailyMemory();
      setDailyMemories(memoryList);
    } catch (error) {
      console.error("Failed to fetch daily memories", error);
      message.error("Failed to load memory list");
    }
  };

  const handleFileNodeClick = async (node: FileTreeNode) => {
    if (node.type !== "file") return;

    // Handle MEMORY.md specially
    if (node.name === "MEMORY.md") {
      if (expandedMemory && selectedFile?.path === node.path) {
        setExpandedMemory(false);
        return;
      } else {
        setExpandedMemory(true);
        fetchDailyMemories();
      }
    }

    setSelectedFile(nodeToSelectedFile(node));
    setLoading(true);
    try {
      const data = await agentsApi.readAgentFileByPath(
        selectedAgent,
        node.path,
      );
      setFileContent(data.content);
      setOriginalContent(data.content);
    } catch (error) {
      console.error("Failed to load file", error);
      message.error("Failed to load file");
    } finally {
      setLoading(false);
    }
  };

  const handleFolderToggle = (folderPath: string) => {
    setExpandedFolders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(folderPath)) {
        newSet.delete(folderPath);
      } else {
        newSet.add(folderPath);
      }
      return newSet;
    });
  };

  const handleDailyMemoryClick = async (daily: DailyMemoryFile) => {
    setSelectedFile({
      filename: `${daily.date}.md`,
      path: daily.path,
      size: daily.size,
      created_time: daily.created_time,
      modified_time: daily.modified_time,
      updated_at: daily.updated_at,
    });
    setLoading(true);
    try {
      const data = await api.loadDailyMemory(daily.date);
      setFileContent(data.content);
      setOriginalContent(data.content);
    } catch (error) {
      console.error("Failed to load daily memory", error);
      message.error("Failed to load daily memory");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedFile) return;
    setLoading(true);
    try {
      if (selectedFile.filename.match(/^\d{4}-\d{2}-\d{2}\.md$/)) {
        const date = selectedFile.filename.replace(".md", "");
        await api.saveDailyMemory(date, fileContent);
      } else {
        await agentsApi.writeAgentFileByPath(
          selectedAgent,
          selectedFile.path,
          fileContent,
        );
      }
      setOriginalContent(fileContent);
      message.success("Saved successfully");
      if (selectedFile.filename.match(/^\d{4}-\d{2}-\d{2}\.md$/)) {
        fetchDailyMemories();
      } else {
        fetchFileTree();
      }
    } catch (error) {
      console.error("Failed to save file", error);
      message.error("Failed to save");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFileContent(originalContent);
  };

  const handleToggleFileEnabled = async (filename: string) => {
    const isEnabling = !enabledFiles.includes(filename);

    // Show warning for MEMORY.md
    if (isEnabling && filename === "MEMORY.md") {
      message.warning({
        content: t("workspace.memoryFileWarning"),
        duration: 5,
      });
    }

    const newEnabledFiles = enabledFiles.includes(filename)
      ? enabledFiles.filter((f) => f !== filename)
      : [...enabledFiles, filename];

    try {
      await workspaceApi.setSystemPromptFiles(newEnabledFiles);
      setEnabledFiles(newEnabledFiles);
      message.success(
        t("workspace.configUpdated") || "System prompt configuration updated",
      );
    } catch (error) {
      console.error("Failed to update system prompt files", error);
      message.error(
        t("workspace.configUpdateFailed") ||
          "Failed to update system prompt configuration",
      );
    }
  };

  const handleReorderFiles = async (newOrder: string[]) => {
    try {
      await workspaceApi.setSystemPromptFiles(newOrder);
      setEnabledFiles(newOrder);
    } catch (error) {
      console.error("Failed to reorder files", error);
      message.error("Failed to update file order");
    }
  };

  const hasChanges = fileContent !== originalContent;

  return {
    fileTree,
    selectedFile,
    dailyMemories,
    expandedMemory,
    expandedFolders,
    fileContent,
    loading,
    workspacePath,
    hasChanges,
    enabledFiles,
    setFileContent,
    fetchFileTree,
    handleFileNodeClick,
    handleFolderToggle,
    handleDailyMemoryClick,
    handleSave,
    handleReset,
    handleToggleFileEnabled,
    handleReorderFiles,
  };
};
