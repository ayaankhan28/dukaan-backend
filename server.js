const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const { OpenAI } = require('openai');

const openai = new OpenAI({apiKey:""});
const cors = require('cors');
const app = express();
const port = 3001;
const Chat = require('./Chat');

const sequelize = require('./database');
sequelize.sync().then(() => console.log('Database is ready'));
app.use(cors());

app.use(bodyParser.json());
app.post('/api/processPayment', async (req, res) => {
    const paymentData = req.body;

    // Process the payment data here
    // This is where you would integrate with your payment gateway

    res.json({ success: true, message: 'Payment processed successfully' });
});

// Other endpoints remain the same...



const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'ayaan.khan2812@gmail.com',
      pass: 'xjpq nkkk bfzi ghkc',
    },
  });
  


async function fetchRoomsAndFilter(budget) {
    const url = 'https://bot9assignement.deno.dev/rooms';
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Network response was not ok ' + response.statusText);
        }
        const data = await response.json();
        const filteredRooms = data.filter(room => room.price <= budget);
        return filteredRooms;
    } catch (error) {
        console.error('There was a problem with the fetch operation:', error);
        throw error;
    }
}
async function Senddetail(roomId, fullName, email, nights,price) {
    const mailOptions = {
        from: 'ayaan.khan2812@gmail.com',
        to: email,
        subject: 'Dukaan Hotel Booking Details',
        text: `Your booking details are as follows: Room ID: ${roomId}, Full Name: ${fullName}, Total prize:${price} for ${nights} nights.`,
      };
      
      // Send email
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.log('Error occurred: ', error);
        } else {
          console.log('Email sent: ', info.response);
        }
      });
    const url = 'https://bot9assignement.deno.dev/book';
  
    // Define the data to be sent in the POST request
    const data = {
      roomId,
      fullName,
      email,
      nights
    };
  
    try {
      // Make the POST request
      const response = await fetch(url, {
        method: 'POST', // Specify the request method
        headers: {
          'Content-Type': 'application/json' // Specify the content type
        },
        body: JSON.stringify(data) // Convert the data to a JSON string
      });
  
      // Check if the response is successful
      if (!response.ok) {
        throw new Error('Network response was not ok ' + response.statusText);
      }
  
      // Parse the response as JSON
      const responseData = await response.json();
  
      // Return the response data
      return responseData;
    } catch (error) {
      // Handle any errors
      console.error('There was a problem with the fetch operation:', error);
      throw error;
    }
  };
const messages = [{
    "role": "system",
    "content": `You are funny hotel booking service provider for company dukaan
    You have to start talkin with user in the language they are using

Booking flow
1. You greet the user first.
2. User asks about room booking
3. You ask for the budget
4. User provides the budget
5. You show the rooms available in the budget using function calling if no room available in the budget then you show the message "No room available in the budget"
6. User selects the room name
7. You ask for the number of nights
8. User provides the number of nights
9. You ask for the number of guests
10. User provides the number of guests
11. You ask for the email
12. User provides the email
13. You ask for the full name
14. User provides the full name
15. You calculate the total price and show it to the user with select house details
16. User confirms the booking
17. You show the booking details with heading booking detailes and you send this data to users email using function calling
18. You show the thank you message
`

}];

const tools = [
    {
        type: "function",
        function: {
            name: "fetchRoomsAndFilter",
            description: "Get the available rooms under the budget",
            parameters: {
                type: "object",
                properties: {
                    budget: {
                        type: "number",
                        description: "it requires the price as budget",
                    },
                },
                required: ["budget"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "Senddetail",
            description: "Send the details to user email",
            parameters: {
                type: "object",
                properties: {
                    roomId: {
                        type: "number",
                        description: "it requires the room id ",
                    },
                    fullName: {
                        type: "string",
                        description: "name of the user",
                    },
                    email: {
                        type: "string",
                        description: "email of the user",
                    },
                    nights: {
                        type: "number",
                        description: "number of nights user want to stay",
                    },
                    price: {
                        type: "number",
                        description: "the total price of the room for the nights user want to stay",
                    },
                },
                required: ["roomId", "fullName", "email", "nights","price"],
            },
        },
    }
];

async function getGPTResponseOpen(prompt) {
    const userMessage = { "role": "user", "content": prompt };
    messages.push(userMessage);
    const response = await openai.chat.completions.create({
        messages: messages,
        model: "gpt-4o",
        tools: tools,
        tool_choice: "auto",
    });
    const responseMessage = response.choices[0].message;

    const toolCalls = responseMessage.tool_calls;
    if (toolCalls) {
        const availableFunctions = {
            fetchRoomsAndFilter: fetchRoomsAndFilter,
            Senddetail: Senddetail,
        };
        messages.push(responseMessage);
        for (const toolCall of toolCalls) {
            const functionName = toolCall.function.name;
            if (functionName === "fetchRoomsAndFilter" ){
                const functionToCall = availableFunctions[functionName];
                const functionArgs = JSON.parse(toolCall.function.arguments);
                const functionResponse = await functionToCall(functionArgs.budget); // Ensure await here

                messages.push({
                    tool_call_id: toolCall.id,
                    role: "tool",
                    name: functionName,
                    content: JSON.stringify(functionResponse), // Ensure content is stringified
                });
            }
            else if (functionName === "Senddetail"){
                const functionToCall = availableFunctions[functionName];
                const functionArgs = JSON.parse(toolCall.function.arguments);
                const functionResponse = await functionToCall(
                    functionArgs.roomId,
                    functionArgs.fullName,
                    functionArgs.email,
                    functionArgs.nights,
                    functionArgs.price
                );
                messages.push({
                    tool_call_id: toolCall.id,
                    role: "tool",
                    name: functionName,
                    content: JSON.stringify(functionResponse),
                });

            }
        }
        const secondResponse = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: messages,
        });
        return secondResponse.choices[0].message.content;
    } else {
        return responseMessage.content;
    }
}

app.post('/api/addtext', async (req, res) => {
    const { prompt } = req.body;
    console.log(`Received prompt: ${prompt}`);
    try {
        const gptResponse = await getGPTResponseOpen(prompt);
        console.log(`GPT response: ${gptResponse}`);

        const assistantMessage = { "role": "assistant", "content": gptResponse };
        messages.push(assistantMessage);
        const chat = await Chat.create({ prompt, response: gptResponse });

        res.json({ response: gptResponse });
    } catch (error) {
        console.error('Error generating response:', error);
        res.status(500).json({ error: 'Error generating response' });
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});