import React, { memo, useEffect } from "react"
import { useRemark } from "react-remark"
import rehypeHighlight, { Options } from "rehype-highlight"
import styled from "styled-components"
import { visit } from "unist-util-visit"
import { Node, Parent } from 'unist'; // Import Node and Parent types
import { useAppContext } from '../../context/AppContext'; // Adapted import
// import MermaidBlock from "./MermaidBlock" // Commented out for now

interface MarkdownBlockProps {
	markdown?: string
}

// Define color locally or import from shared styles if available
const CODE_BLOCK_BG_COLOR = 'rgba(128, 128, 128, 0.1)'; // Example color

/**
 * Custom remark plugin that converts plain URLs in text into clickable links
 */
const remarkUrlToLink = () => {
	return (tree: Node) => {
		// Use 'any' for node within visitor to access 'value'
		visit(tree, "text", (node: any, index: number | undefined, parent: Parent | undefined) => {
			const urlRegex = /https?:\/\/[^\s<>)"]+/g
			// Ensure node.value exists and is a string before matching
			if (typeof node.value !== 'string') return;
			const matches = node.value.match(urlRegex)
			if (!matches) return

			const parts = node.value.split(urlRegex)
			const children: any[] = []

			parts.forEach((part: string, i: number) => {
				if (part) children.push({ type: "text", value: part })
				if (matches[i]) {
					children.push({
						type: "link",
						url: matches[i],
						children: [{ type: "text", value: matches[i] }],
					})
				}
			})

			if (parent && typeof index === 'number') {
				parent.children.splice(index, 1, ...children)
			}
		})
	}
}

/**
 * Custom remark plugin that prevents filenames with extensions from being parsed as bold text
 */
const remarkPreventBoldFilenames = () => {
	return (tree: Node) => {
		// Use 'any' for node and nextNode within visitor to access 'value' and 'children'
		visit(tree, "strong", (node: any, index: number | undefined, parent: Parent | undefined) => {
			if (!parent || typeof index === "undefined" || index === parent.children.length - 1) return
			const nextNode: any = parent.children[index + 1] // Cast nextNode to any
			// Ensure nextNode.value exists and is a string before matching
			if (nextNode.type !== "text" || typeof nextNode.value !== 'string' || !nextNode.value.match(/^\.[a-zA-Z0-9]+/)) return
			if (node.children?.length !== 1) return
			const strongContent = node.children?.[0]?.value
			if (!strongContent || typeof strongContent !== "string") return
			if (!strongContent.match(/^[a-zA-Z0-9_-]+$/)) return

			const newNode = {
				type: "text",
				value: `__${strongContent}__${nextNode.value}`,
			}
			parent.children.splice(index, 2, newNode)
		})
	}
}

// Basic styling, can be refined to match VSCode theme variables later
const StyledMarkdown = styled.div`
	pre {
		background-color: ${CODE_BLOCK_BG_COLOR};
		border-radius: 3px;
		margin: 1em 0; /* Use em for relative spacing */
		padding: 10px;
		max-width: 100%; /* Adjust for container */
		overflow-x: auto;
		overflow-y: hidden;
	}

	pre > code {
		/* Basic diff styling */
		.hljs-deletion {
			background-color: rgba(255, 0, 0, 0.2); /* Example */
			display: inline-block;
			width: 100%;
		}
		.hljs-addition {
			background-color: rgba(0, 255, 0, 0.2); /* Example */
			display: inline-block;
			width: 100%;
		}
	}

	code {
		span.line:empty {
			display: none;
		}
		word-wrap: break-word;
		border-radius: 3px;
		background-color: ${CODE_BLOCK_BG_COLOR};
		font-size: 0.9em; /* Relative font size */
		font-family: monospace; /* Standard monospace */
	}

	code:not(pre > code) {
		font-family: monospace;
		color: #c7254e; /* Example inline code color */
		background-color: #f9f2f4; /* Example inline code background */
		padding: 2px 4px;
		border-radius: 3px;
		border: 1px solid #d4d4d4; /* Example border */
		white-space: pre-line;
		word-break: break-word;
		overflow-wrap: anywhere;
	}

	font-family: sans-serif; /* Standard sans-serif */
	font-size: 1em; /* Base font size */

	p,
	li,
	ol,
	ul {
		line-height: 1.4; /* Slightly increased line height */
	}

	ol,
	ul {
		padding-left: 2em; /* Standard indentation */
		margin-left: 0;
	}

	p {
		white-space: pre-wrap;
		margin-bottom: 1em; /* Spacing between paragraphs */
	}

	a {
		color: #007bff; /* Standard link color */
		text-decoration: none;
		&:hover {
			text-decoration: underline;
		}
	}
`

// Simplified pre styling without theme dependency
const StyledPre = styled.pre`
	& .hljs {
		color: #333; /* Default text color */
		background: none; /* Ensure no background override */
	}
	/* Add basic highlight.js styles if needed, or rely on rehype-highlight defaults */
`;


const MarkdownBlock = memo(({ markdown }: MarkdownBlockProps) => {
	// const { theme } = useAppContext(); // Removed theme usage
	const [reactContent, setMarkdown] = useRemark({
		remarkPlugins: [
			remarkPreventBoldFilenames,
			remarkUrlToLink,
			() => {
				return (tree: Node) => { // Add type Node
					visit(tree, "code", (node: any) => {
						// Default to javascript if no language specified
						if (!node.lang) {
							node.lang = "javascript"
						} else if (node.lang.includes(".")) {
							// Handle cases like `python.py` -> `py`
							node.lang = node.lang.split(".").pop() || "javascript";
						}
					})
				}
			},
		],
		rehypePlugins: [
			// Re-add 'as any' to bypass complex type checking for rehypeHighlight
			[rehypeHighlight as any, { detect: true, ignoreMissing: true }]
		],
		rehypeReactOptions: {
			components: {
				pre: ({ node, children, ...preProps }: any) => {
					// Mermaid handling commented out
					// if (Array.isArray(children) && children.length === 1 && React.isValidElement(children[0])) {
					// 	const child = children[0] as React.ReactElement<{ className?: string }>
					// 	if (child.props?.className?.includes("language-mermaid")) {
					// 		// return <MermaidBlock code={String(child.props.children || '')} />;
					//     return <pre {...preProps}>MERMAID PLACEHOLDER</pre>; // Placeholder
					// 	}
					// }
					// Use simplified StyledPre without theme
					return (
						<StyledPre {...preProps}>
							{children}
						</StyledPre>
					)
				},
				code: (props: any) => {
					const className = props.className || ""
					// Mermaid handling commented out
					// if (className.includes("language-mermaid")) {
					// 	const codeText = String(props.children || "")
					// 	// return <MermaidBlock code={codeText} />
          //   return <code>MERMAID PLACEHOLDER</code>; // Placeholder
					// }
					return <code {...props} />
				},
			},
		},
	})

	useEffect(() => {
		setMarkdown(markdown || "")
	}, [markdown, setMarkdown]) // Removed theme dependency

	return (
		<div> {/* Removed style={{}} */}
			<StyledMarkdown>{reactContent}</StyledMarkdown>
		</div>
	)
})

export default MarkdownBlock
