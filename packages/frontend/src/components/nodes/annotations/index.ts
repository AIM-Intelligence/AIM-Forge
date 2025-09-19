import MarkdownNoteNode from "./MarkdownNoteNode";

export { MarkdownNoteNode };

export const annotationsComponents = [
  {
    id: "markdown-note",
    name: "Markdown Text",
    description: "투명한 텍스트 상자에 Markdown 형식으로 메모를 남깁니다.",
    icon: "🗒️",
    template: "annotations/markdown_note",
    nodeType: "markdownNote",
    componentType: "MarkdownNote",
    component: MarkdownNoteNode,
  },
];
