import MarkdownNoteNode from "./MarkdownNoteNode";

export { MarkdownNoteNode };

export const annotationsComponents = [
  {
    id: "markdown-note",
    name: "Markdown Text",
    description: "Markdown Note",
    icon: "🗒️",
    template: "annotations/markdown_note",
    nodeType: "markdownNote",
    componentType: "MarkdownNote",
    component: MarkdownNoteNode,
  },
];
