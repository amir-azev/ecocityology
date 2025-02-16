import React from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

const WordFetcher = ({
    description,
    setDescription,
    limit,
    setLimit,
    handleSubmit,
    loading
}) => {
    return (
        <div className="w-full md:w-1/2 p-4 border rounded-md shadow-sm bg-gray-50">
            <h2 className="w-full  text-lg font-bold">Word Fetcher</h2>
            <form onSubmit={handleSubmit}>
                <div className="mb-4">
                    <Label htmlFor="description">Word Description</Label>
                    <Input
                        id="description"
                        type="text"
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="Describe a group of words (e.g. 'numbers from 1 to 10')"
                        required
                        className="mt-1 block w-full"
                    />
                </div>

                <div className="mb-4">
                    <Label htmlFor="limit">Limit</Label>
                    <Input
                        id="limit"
                        type="number"
                        value={limit}
                        onChange={e => setLimit(Number(e.target.value))}
                        min="1"
                        max="100"
                        required
                        className="mt-1 block w-full"
                    />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Fetching..." : "Get Words"}
                </Button>
            </form>
        </div>
    )
}

export default WordFetcher
