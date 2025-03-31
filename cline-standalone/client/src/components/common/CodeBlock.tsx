import React, { memo, useEffect } from "react"
import { useRemark } from "react-remark"
import rehypeHighlight, { Options } from "rehype-highlight"
import styled from "styled-components"
import { visit } from "unist-util-visit"
import { Node } from 'unist'; // Import Node type
// import { useAppContext } from "../../context/AppContext"; // Not needed after removing theme

// Define color locally or import from shared styles if available
export const CODE_BLOCK_BG_COLOR = 'rgba(128, 128, 128, 0.1)'; // Example color

/*
overflowX: auto + inner div with padding results in an issue where the top/left/bottom padding renders but the right padding inside does not count as overflow as the width of the element is not exceeded. Once the inner div is outside the boundaries of the parent it counts as overflow.
https://stackoverflow.com/questions/60778406/why-is-padding-right-clipped-with-overflowscroll/77292459#77292459
this fixes the issue of right padding clipped off
“ideal” size in a given axis when given infinite available space--allows the syntax highlighter to grow to largest possible width including its padding
minWidth: "max-content",
*/

interface CodeBlockProps {
	source?: string
	forceWrap?: boolean
}

// Basic styling, adapted from original
const StyledMarkdown = styled.div<{ forceWrap: boolean }>`
	${({ forceWrap }) =>
		forceWrap &&
		`
    pre, code {
      white-space: pre-wrap;
      word-break: break-all;
      overflow-wrap: anywhere;
    }
  `}

	pre {
		background-color: ${CODE_BLOCK_BG_COLOR};
		border-radius: 5px;
		margin: 0;
		min-width: ${({ forceWrap }) => (forceWrap ? "auto" : "max-content")};
		padding: 10px;
		color: #333; /* Default text color */
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
		border-radius: 5px;
		background-color: ${CODE_BLOCK_BG_COLOR};
		font-size: 0.9em; /* Relative font size */
		font-family: monospace; /* Standard monospace */
	}

	code:not(pre > code) {
		font-family: monospace;
		color: #c7254e; /* Example inline code color */
		/* Inline code doesn't typically need background in this context */
	}

	background-color: ${CODE_BLOCK_BG_COLOR};
	font-family: sans-serif; /* Standard sans-serif */
	font-size: 1em; /* Base font size */
	color: #333; /* Default text color */

	p,
	li,
	ol,
	ul {
		line-height: 1.5;
	}
`

// Removed StyledPre as theme is not used

const CodeBlock = memo(({ source, forceWrap = false }: CodeBlockProps) => {
	// const { theme } = useAppContext(); // Removed theme usage
	const [reactContent, setMarkdownSource] = useRemark({
		remarkPlugins: [
			() => {
				return (tree: Node) => { // Add type Node
					visit(tree, "code", (node: any) => {
						if (!node.lang) {
							node.lang = "javascript" // Default language
						} else if (node.lang.includes(".")) {
							// if the language is a file, get the extension
							node.lang = node.lang.split(".").pop() || "javascript";
						}
					})
				}
			},
		],
		rehypePlugins: [
			// Add 'as any' to bypass complex type checking for rehypeHighlight
			[rehypeHighlight as any, { detect: true, ignoreMissing: true }]
		],
		rehypeReactOptions: {
			components: {
				// Use standard pre, styling is handled by StyledMarkdown
				pre: ({ node, ...preProps }: any) => <pre {...preProps} />,
			},
		},
	})

	useEffect(() => {
		setMarkdownSource(source || "")
	}, [source, setMarkdownSource]) // Removed theme dependency

	return (
		<div
			style={{
				overflowX: forceWrap ? "visible" : "auto", // Changed to overflowX for horizontal scroll
				overflowY: "visible", // Allow vertical expansion
				maxHeight: "none", // Remove max height constraint
				backgroundColor: CODE_BLOCK_BG_COLOR,
				borderRadius: '5px', // Add border radius to the container
			}}>
			<StyledMarkdown forceWrap={forceWrap}>{reactContent}</StyledMarkdown>
		</div>
	)
})

export default CodeBlock
