import React from "react";
import { Button, Card } from "@agentscope-ai/design";
import { ReloadOutlined } from "@ant-design/icons";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import type { FileTreeNode, DailyMemoryFile } from "../../../../api/types";
import { FileTreeItem } from "./FileTreeItem";
import { formatFileSize, formatTimeAgo } from "./utils";
import { useTranslation } from "react-i18next";
import styles from "../index.module.less";

interface FileListPanelProps {
  fileTree: FileTreeNode[];
  selectedFile: { path: string; filename: string } | null;
  dailyMemories: DailyMemoryFile[];
  expandedMemory: boolean;
  expandedFolders: Set<string>;
  workspacePath: string | null;
  enabledFiles: string[];
  onRefresh: () => void;
  onFileClick: (node: FileTreeNode) => void;
  onFolderToggle: (folderPath: string) => void;
  onDailyMemoryClick: (daily: DailyMemoryFile) => void;
  onToggleEnabled: (filename: string) => void;
  onReorder: (newOrder: string[]) => void;
}

// Flatten tree for display, respecting expanded state
const flattenTreeForDisplay = (
  nodes: FileTreeNode[],
  expandedFolders: Set<string>,
  depth = 0,
): { node: FileTreeNode; depth: number }[] => {
  const result: { node: FileTreeNode; depth: number }[] = [];

  for (const node of nodes) {
    result.push({ node, depth });

    // Recursively add children if directory is expanded
    if (
      node.type === "directory" &&
      expandedFolders.has(node.path) &&
      node.children
    ) {
      result.push(...flattenTreeForDisplay(node.children, expandedFolders, depth + 1));
    }
  }

  return result;
};

// Get enabled items for sortable context (only root-level markdown files)
const getEnabledItems = (
  nodes: FileTreeNode[],
  enabledFiles: string[],
): string[] => {
  const items: string[] = [];
  for (const node of nodes) {
    if (node.type === "file" && enabledFiles.includes(node.name)) {
      items.push(node.path);
    }
  }
  return items;
};

export const FileListPanel: React.FC<FileListPanelProps> = ({
  fileTree,
  selectedFile,
  dailyMemories,
  expandedMemory,
  expandedFolders,
  enabledFiles,
  onRefresh,
  onFileClick,
  onFolderToggle,
  onDailyMemoryClick,
  onToggleEnabled,
  onReorder,
}) => {
  const { t } = useTranslation();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
  );

  const flattenedItems = flattenTreeForDisplay(fileTree, expandedFolders);
  const enabledItems = getEnabledItems(fileTree, enabledFiles);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = enabledItems.indexOf(active.id as string);
    const newIndex = enabledItems.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove(enabledItems, oldIndex, newIndex);

    // Convert paths back to filenames for the API
    const filenames = newOrder.map((path) => {
      const parts = path.split("/");
      return parts[parts.length - 1];
    });
    onReorder(filenames);
  };

  return (
    <div className={styles.fileListPanel}>
      <Card
        bodyStyle={{
          padding: 16,
          display: "flex",
          flexDirection: "column",
          height: "100%",
          overflow: "auto",
        }}
        style={{ flex: 1, minHeight: 0 }}
      >
        <div className={styles.headerRow}>
          <h3 className={styles.sectionTitle}>{t("workspace.workspaceFiles")}</h3>
          <Button size="small" onClick={onRefresh} icon={<ReloadOutlined />}>
            {t("common.refresh")}
          </Button>
        </div>

        <p className={styles.infoText}>{t("workspace.workspaceFilesDesc")}</p>
        <div className={styles.divider} />

        <div className={styles.scrollContainer}>
          {flattenedItems.length > 0 ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={enabledItems}
                strategy={verticalListSortingStrategy}
              >
                {flattenedItems.map(({ node, depth }) => {
                  const isEnabled = enabledFiles.includes(node.name);
                  return (
                    <React.Fragment key={node.path}>
                      <FileTreeItem
                        node={node}
                        selectedFile={selectedFile}
                        expandedFolders={expandedFolders}
                        expandedMemory={expandedMemory}
                        depth={depth}
                        enabled={isEnabled}
                        onFileClick={onFileClick}
                        onFolderToggle={onFolderToggle}
                        onToggleEnabled={onToggleEnabled}
                      />

                      {/* Daily memory list under MEMORY.md */}
                      {node.name === "MEMORY.md" &&
                        expandedMemory &&
                        depth === 0 && (
                          <div className={styles.dailyMemoryList}>
                            {dailyMemories.map((daily) => {
                              const isDailySelected =
                                selectedFile?.filename === `${daily.date}.md`;
                              return (
                                <div
                                  key={daily.date}
                                  onClick={() => onDailyMemoryClick(daily)}
                                  className={`${styles.dailyMemoryItem} ${
                                    isDailySelected ? styles.selected : ""
                                  }`}
                                  style={{
                                    marginLeft: `${12 + (depth + 1) * 16}px`,
                                  }}
                                >
                                  <div className={styles.dailyMemoryName}>
                                    {daily.date}.md
                                  </div>
                                  <div className={styles.dailyMemoryMeta}>
                                    {formatFileSize(daily.size)} ·{" "}
                                    {formatTimeAgo(daily.updated_at)}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                    </React.Fragment>
                  );
                })}
              </SortableContext>
            </DndContext>
          ) : (
            <div className={styles.emptyState}>{t("workspace.noFiles")}</div>
          )}
        </div>
      </Card>
    </div>
  );
};
