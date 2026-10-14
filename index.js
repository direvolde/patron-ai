require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const OpenAI = require('openai');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    }
});

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('QR Kodu taratarak giriş yapın.');
});

client.on('ready', () => {
    console.log('WhatsApp bağlantısı başarılı, PatronAi hazır!');
});

// Fonksiyon tanımları
const tools = [
    {
        type: "function",
        function: {
            name: "summarize_groups",
            description: "Belirli WhatsApp gruplarındaki son mesajları çekip özetler.",
            parameters: {
                type: "object",
                properties: {
                    group_names: {
                        type: "array",
                        items: { type: "string" },
                        description: "Özetlenecek WhatsApp gruplarının adları."
                    }
                },
                required: ["group_names"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "search_and_contact_suppliers",
            description: "Belirtilen ürün veya hizmet için arama yapıp, bulunan numaraya WhatsApp üzerinden ilk teklif/fiyat mesajını atar.",
            parameters: {
                type: "object",
                properties: {
                    product_or_service: {
                        type: "string",
                        description: "Aranacak ürün veya hizmet."
                    },
                    offer_message: {
                        type: "string",
                        description: "Tedarikçiye gönderilecek teklif mesajı."
                    }
                },
                required: ["product_or_service", "offer_message"]
            }
        }
    }
];

client.on('message_create', async (message) => {
    // Sadece kullanıcının kendi kendine attığı ("Siz / Me") sohbetindeki mesajları dinle
    if (message.fromMe && message.to === client.info.wid._serialized) {
        console.log(`Yeni komut alındı: ${message.body}`);
        
        try {
            const response = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: message.body }],
                tools: tools,
                tool_choice: "auto",
            });

            const responseMessage = response.choices[0].message;
            let finalReply = responseMessage.content || "";

            if (responseMessage.tool_calls) {
                for (const toolCall of responseMessage.tool_calls) {
                    const functionName = toolCall.function.name;
                    const functionArgs = JSON.parse(toolCall.function.arguments);

                    if (functionName === 'summarize_groups') {
                        finalReply += `\n[Sistem] Gruplar özetleniyor: ${functionArgs.group_names.join(', ')}\n`;
                        
                        // WhatsApp'tan grupları bul ve son mesajları çek
                        const chats = await client.getChats();
                        const groups = chats.filter(c => c.isGroup && functionArgs.group_names.includes(c.name));
                        
                        let allMessages = "";
                        for (const group of groups) {
                            const msgs = await group.fetchMessages({ limit: 10 });
                            allMessages += `\n--- ${group.name} ---\n`;
                            msgs.forEach(m => {
                                allMessages += `${m.author || m.from}: ${m.body}\n`;
                            });
                        }

                        if (allMessages.trim() === "") {
                            finalReply += "[Sistem] Belirtilen gruplarda mesaj bulunamadı veya gruplar bulunamadı.\n";
                        } else {
                            // Mesajları özetlemesi için tekrar OpenAI'a gönder
                            const summaryResponse = await openai.chat.completions.create({
                                model: 'gpt-4o-mini',
                                messages: [
                                    { role: 'system', content: 'Aşağıdaki WhatsApp mesajlarını kısa ve öz bir şekilde özetle.' },
                                    { role: 'user', content: allMessages }
                                ]
                            });
                            finalReply += `\nÖzet:\n${summaryResponse.choices[0].message.content}\n`;
                        }

                    } else if (functionName === 'search_and_contact_suppliers') {
                        const product = functionArgs.product_or_service;
                        const offerMsg = functionArgs.offer_message;
                        finalReply += `\n[Sistem] '${product}' için tedarikçiler aranıyor ve iletişime geçiliyor...\n`;
                        
                        // Mock arama ve iletişim mantığı
                        // Gerçek bir sistemde burada Google/Bing Search API veya bir veritabanı araması yapılır.
                        const dummySupplierNumber = "905551234567"; 
                        const chatId = `${dummySupplierNumber}@c.us`;
                        
                        await client.sendMessage(chatId, offerMsg);
                        finalReply += `[Sistem] Bulunan tedarikçiye (${dummySupplierNumber}) teklif mesajı gönderildi.\n`;
                    }
                }
            }
            
            if (finalReply.trim()) {
                await client.sendMessage(message.to, finalReply);
            }

        } catch (error) {
            console.error('OpenAI veya işleyiş hatası:', error);
            await client.sendMessage(message.to, 'Üzgünüm, bir hata oluştu: ' + error.message);
        }
    }
});

client.initialize();
