import React from "react";
import { Switch, Tooltip } from "@agentscope-ai/design";
import {
  CaretDownOutlined,
  CaretRightOutlined,
  FolderOutlined,
  FolderOpenOutlined,
  FileOutlined,
  FileMarkdownOutlined,
  HolderOutlined,
} from "@ant-design/icons";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { FileTreeNode } from "../../../../api/types";
import { formatFileSize, formatTimeAgo } from "./utils";
import { useTranslation } from "react-i18next";
import styles from "../index.module.less";

interface FileTreeItemProps {
  node: FileTreeNode;
  selectedFile: { path: string } | null;
  expandedFolders: Set<string>;
  expandedMemory: boolean;
  depth?: number;
  enabled?: boolean;
  onFileClick: (node: FileTreeNode) => void;
  onFolderToggle: (folderPath: string) => void;
  onToggleEnabled?: (filename: string) => void;
}

export const FileTreeItem: React.FC<FileTreeItemProps> = ({
  node,
  selectedFile,
  expandedFolders,
  expandedMemory,
  depth = 0,
  enabled = false,
  onFileClick,
  onFolderToggle,
  onToggleEnabled,
}) => {
  const { t } = useTranslation();
  const isSelected = selectedFile?.path === node.path;
  const isExpanded = expandedFolders.has(node.path);
  const isDirectory = node.type === "directory";
  const isMemoryFile = node.name === "MEMORY.md" && !isDirectory;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: node.path,
    disabled: !enabled || isDirectory,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleToggleClick = (
    _checked: boolean,
    event:
      | React.MouseEvent<HTMLButtonElement>
      | React.KeyboardEvent<HTMLButtonElement>,
  ) => {
    event.stopPropagation();
    onToggleEnabled?.(node.name);
  };

  const handleClick = () => {
    if (isDirectory) {
      onFolderToggle(node.path);
    } else {
      onFileClick(node);
    }
  };

  // Render folder icon based on expanded state
  const renderFolderIcon = () => {
    if (isExpanded) {
      return <FolderOpenOutlined className={styles.folderIcon} />;
    }
    return <FolderOutlined className={styles.folderIcon} />;
  };

  // Render file icon based on file type
  const renderFileIcon = () => {
    if (node.name.endsWith(".md")) {
      return <FileMarkdownOutlined className={styles.fileIcon} />;
    }
    return <FileOutlined className={styles.fileIcon} />;
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div
        onClick={handleClick}
        className={`${styles.fileTreeItem} ${isSelected ? styles.selected : ""} ${
          isDragging ? styles.dragging : ""
        } ${isDirectory ? styles.directory : ""}`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        <div className={styles.fileTreeItemContent}>
          {enabled && !isDirectory && (
            <div
              className={styles.dragHandle}
              {...attributes}
              {...listeners}
              onClick={(e) => e.stopPropagation()}
            >
              <HolderOutlined />
            </div>
          )}

          {!enabled && !isDirectory && <div className={styles.dragHandlePlaceholder} />}

          {/* Expand/Collapse icon for folders, or spacer for files */}
          {isDirectory ? (
            <span className={styles.expandIcon}>
              {isExpanded ? <CaretDownOutlined /> : <CaretRightOutlined />}
            </span>
          ) : (
            <span className={styles.expandIconPlaceholder} />
          )}

          {/* File/Folder icon */}
          <span className={styles.icon}>
            {isDirectory ? renderFolderIcon() : renderFileIcon()}
          </span>

          <div className={styles.fileInfo}>
            <div className={styles.fileItemName}>
              {enabled && !isDirectory && (
                <span className={styles.enabledBadge}>●</span>
              )}
              {node.name}
            </div>
            {!isDirectory && (
              <div className={styles.fileItemMeta}>
                {formatFileSize(node.size)} ·{" "}
                {formatTimeAgo(new Date(node.modified_time).getTime())}
              </div>
            )}
          </div>

          {/* Show toggle only for markdown files in root, not directories */}
          {!isDirectory && onToggleEnabled && node.name.endsWith(".md") && (
            <div className={styles.fileItemActions}>
              <Tooltip title={t("workspace.systemPromptToggleTooltip")}>
                <Switch
                  size="small"
                  checked={enabled}
                  onClick={handleToggleClick}
                />
              </Tooltip>
              {isMemoryFile && (
                <span className={styles.expandIcon}>
                  {expandedMemory ? (
                    <CaretDownOutlined />
                  ) : (
                    <CaretRightOutlined />
                  )}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
