import OpenAI from "openai"

// Access the API key from the .env file
const API_KEY = import.meta.env.VITE_OPENAI_API_KEY

// Initialize OpenAI with the API key
const openai = new OpenAI({
    apiKey: API_KEY, // Automatically uses the key from the environment variable
    dangerouslyAllowBrowser: true
})

export const fetchWords = async (description, limit) => {
    try {
        // Send the completion request to OpenAI
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini", // Ensure the correct model name is used (gpt-4 is valid)
            messages: [
                { role: "system", content: "You output a list of words separated by commas" },
                {
                    role: "user",
                    content: `Respond with only a list of words based on this description: "${description}". Do not list more than ${limit} words, you can list less`
                }
            ]
        })

        // Extract the text response from the completion object
        const responseText = completion.choices[0].message.content


        // Split the response into an array of words
        return responseText.split(",")
            .map(word => word.trim().replace(/\s+/g, ""))
            .filter(word => word !== ".")
        // return responseText.split(",").filter(word => word.trim() !== ".")
    } catch (error) {
        console.error("Error fetching words:", error)
        throw error // You can also handle the error differently based on your app needs
    }
}
