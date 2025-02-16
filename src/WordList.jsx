import React, { useState } from "react"
import { Badge } from "@/components/ui/badge"

const WordList = ({ words, rules }) => {
    const [hoveredRule, setHoveredRule] = useState(null) // Track which rule is hovered
    const [hoveredWordIndex, setHoveredWordIndex] = useState(null) // Track which word is hovered

    // Convert a hex color to an RGBA with transparency
    const hexToRgba = (hex, alpha) => {
        let r = 0,
            g = 0,
            b = 0
        if (hex.length === 4) {
            r = parseInt(hex[1] + hex[1], 16)
            g = parseInt(hex[2] + hex[2], 16)
            b = parseInt(hex[3] + hex[3], 16)
        } else if (hex.length === 7) {
            r = parseInt(hex[1] + hex[2], 16)
            g = parseInt(hex[3] + hex[4], 16)
            b = parseInt(hex[5] + hex[6], 16)
        }
        return `rgba(${r}, ${g}, ${b}, ${alpha})`
    }

    // Helper function to check if all parts of a rule match are in the word
    const doesWordMatchRule = (word, match) => {
        const parts = match.split(",") // Split match by comma
        return parts.every(part => word.includes(part)) // Check if all parts exist in the word
    }

    // Function to apply rules and highlight words
    const applyRulesToWords = (word, wordIndex) => {
        const layers = []

        rules.forEach((rule, ruleIndex) => {
            const matchParts = rule.match.split(",") // Split the rule match by comma

            if (doesWordMatchRule(word, rule.match)) {
                let highlightedWord = word

                // Loop through each part of the match and find & highlight them
                matchParts.forEach(part => {
                    let matchIndex = word.indexOf(part)
                    while (matchIndex !== -1) {
                        const beforeMatch = highlightedWord.substring(0, matchIndex)
                        const match = highlightedWord.substring(
                            matchIndex,
                            matchIndex + part.length
                        )
                        const afterMatch = highlightedWord.substring(
                            matchIndex + part.length
                        )

                        const opacity =
                            hoveredRule === ruleIndex && hoveredWordIndex === wordIndex
                                ? 1
                                : 0.3 // Full opacity when hovered

                        // Create a layer for each rule match and stack them using position: absolute
                        layers.push(
                            <span
                                key={`layer-${ruleIndex}-${matchIndex}-${part}`}
                                style={{
                                    position: "absolute",
                                    left: 0,
                                    right: 0,
                                    top: 0,
                                    zIndex: ruleIndex,
                                    pointerEvents: "none", // Disable user interaction for stacked elements
                                    whiteSpace: "pre" // Maintain spaces in the text
                                }}
                            >
                                <span>{beforeMatch}</span>
                                <span
                                    style={{
                                        backgroundColor: hexToRgba(rule.color, opacity), // Adjust opacity
                                        transition: "background-color 0.3s ease"
                                    }}
                                >
                                    {match}
                                </span>
                                <span>{afterMatch}</span>
                            </span>
                        )

                        matchIndex = word.indexOf(part, matchIndex + part.length) // Find the next occurrence of this part
                    }
                })
            }
        })

        // Wrapping the word layers inside a relative container
        return (
            <span style={{ position: "relative", display: "inline-block" }}>
                {word} {/* Base word, unstyled, at the bottom */}
                {layers} {/* Stacked highlights */}
            </span>
        )
    }

    return (
        <div className=" p-4 border rounded-md bg-gray-50 shadow-sm">
            <h2 className="text-lg font-semibold mb-4 text-center">
                Generated Words with Labels
            </h2>
            <ul className="list-disc ml-6 text-lg ">
                {words.map((word, wordIndex) => (
                    <li key={wordIndex}>
                        {applyRulesToWords(word, wordIndex)}
                        {rules.map(
                            (rule, ruleIndex) =>
                                doesWordMatchRule(word, rule.match) && (
                                    <Badge
                                        key={ruleIndex}
                                        className="ml-2 select-none"
                                        style={{
                                            backgroundColor: hexToRgba(
                                                rule.color,
                                                hoveredRule === ruleIndex &&
                                                    hoveredWordIndex === wordIndex
                                                    ? 1
                                                    : 0.3
                                            ), // Adjust opacity based on hover
                                            transition: "background-color 0.3s ease" // Smooth transition
                                        }}
                                        onMouseEnter={() => {
                                            setHoveredRule(ruleIndex) // Set hover rule
                                            setHoveredWordIndex(wordIndex) // Set hover word
                                        }}
                                        onMouseLeave={() => {
                                            setHoveredRule(null) // Clear hover rule
                                            setHoveredWordIndex(null) // Clear hover word
                                        }}
                                    >
                                        {rule.label}
                                    </Badge>
                                )
                        )}
                    </li>
                ))}
            </ul>
        </div>
    )
}

export default WordList
