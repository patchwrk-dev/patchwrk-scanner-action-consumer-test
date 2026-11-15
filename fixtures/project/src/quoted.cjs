const { 'OpenAI': Client } = require('openai');
const client = new Client({apiKey:'SYNTHETIC_QUALIFICATION_SENTINEL'});
client.completions.create({model:'text-davinci-003',prompt:'SYNTHETIC_ONLY'});
