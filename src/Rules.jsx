import React from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
    Dialog,
    DialogTrigger,
    DialogContent,
    DialogTitle,
    DialogDescription,
    DialogClose
} from "@/components/ui/dialog"
import { Info } from "lucide-react"

const Rules = ({
    matchString,
    setMatchString,
    label,
    setLabel,
    color,
    setColor,
    rules,
    handleAddRule,
    handleUpdateRuleColor,
    handleDeleteRule
}) => {
    return (
        <div className="w-full md:w-1/2 border rounded-md shadow-sm bg-gray-50">
            <div className="flex items-center justify-between p-4">
                <h2 className="text-lg font-bold">Rules</h2>
                <Dialog>
                    <DialogTrigger asChild>
                        <Button variant="outline">
                            <Info className="w-6 h-6" />
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogTitle>How to Create a Rule</DialogTitle>
                        <DialogDescription>
                            <p>To create a rule, follow these steps:</p>
                            <ul className="list-disc ml-6 mt-2">
                                <li>
                                    <strong>String to Match</strong>: Enter the string that should
                                    be matched in the word.
                                </li>
                                <li>
                                    <strong>Label to Add</strong>: Enter a label to associate with
                                    the match.
                                </li>
                                <li>
                                    <strong>Color</strong>: Choose a color for the label.
                                </li>
                                <li>
                                    <strong>Multiple Strings</strong>: If you want to match
                                    multiple strings within the same rule, separate them with a
                                    comma (e.g., "i,e" means the rule is matched if both "i" and
                                    "e" are in the word).
                                </li>
                                <li>Click "Add Rule" to save the rule.</li>
                            </ul>
                        </DialogDescription>
                        <DialogClose asChild>
                            <Button className="mt-4">Close</Button>
                        </DialogClose>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="flex flex-row p-4">
                <div className="w-1/2 pr-4">
                    <div className="mb-4">
                        <Label htmlFor="matchString">String to Match</Label>
                        <Input
                            id="matchString"
                            type="text"
                            value={matchString}
                            onChange={e => setMatchString(e.target.value)}
                            placeholder="Enter a string to match"
                            className="mt-1 block w-full"
                        />
                    </div>

                    <div className="mb-4">
                        <Label htmlFor="label">Label to Add</Label>
                        <Input
                            id="label"
                            type="text"
                            value={label}
                            onChange={e => setLabel(e.target.value)}
                            placeholder="Enter a label to add"
                            className="mt-1 block w-full"
                        />
                    </div>

                    <div className="mb-4">
                        <Label htmlFor="color">Color</Label>
                        <Input
                            id="color"
                            type="color"
                            value={color}
                            onChange={e => setColor(e.target.value)}
                            className="mt-1 block w-full"
                        />
                    </div>

                    <Button onClick={handleAddRule} className="w-full">
                        Add Rule
                    </Button>
                </div>

                <div className="w-1/2 pl-4 border-l">
                    <div>
                        <ul className="list-disc mt-2">
                            {rules.map((rule, index) => (
                                <li key={index} className="flex items-center justify-between">
                                    <span className="flex">
                                        {rule.match} ➡ {rule.label}
                                        <Input
                                            type="color"
                                            value={rule.color}
                                            onChange={e =>
                                                handleUpdateRuleColor(index, e.target.value)
                                            }
                                            className="ml-2 w-10 h-5 px-1 py-0"
                                        />
                                    </span>
                                    <Button
                                        variant="secondary"
                                        // Add delete handler
                                        onClick={() => handleDeleteRule(index)}
                                        className="ml-2 p-1 w-5 h-5"
                                    >
                                        ✖
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Rules
