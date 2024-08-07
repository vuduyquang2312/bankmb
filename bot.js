const TelegramBot = require('node-telegram-bot-api');

const { MB } = require('mbbank');
const { MongoClient } = require('mongodb');
const { format } = require('date-fns');
const crypto = require('crypto').webcrypto;
globalThis.crypto = crypto;
const token = '7270770179:AAFO4JKYXY_qEHjEwnYr7pd5H5Iv7Oh74bI';
const bot = new TelegramBot(token, { polling: true });
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const fs = require('fs');

const mongoUrl = 'mongodb://localhost:27017';
const dbName = 'telegramBot';
const client = new MongoClient(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true });

let db;

(async () => {
    try {
        await client.connect();
        console.log('Connected to MongoDB');
        db = client.db(dbName);
    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
    }
})();

const userState = {};

bot.onText(/\/clear/, async (msg) => {
    const chatId = msg.chat.id;

    try {
        const updates = await bot.getUpdates({ chat_id: chatId });
        const messageIds = updates.map(update => update.message.message_id);

        await Promise.all(messageIds.map(messageId => bot.deleteMessage(chatId, messageId)));

        bot.sendMessage(chatId, 'Đã xóa toàn bộ tin nhắn trong cuộc trò chuyện.');
    } catch (error) {
        bot.sendMessage(chatId, 'Đã xảy ra lỗi khi xóa tin nhắn.');
        console.error('Lỗi khi xóa tin nhắn:', error);
    }
});
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const messageText = msg.text.toString().toLowerCase();

    if (messageText.includes('/start')) {
        const collection = db.collection('users');
        const user = await collection.findOne({ chatId });

        if (user) {
            bot.sendMessage(chatId, 'Chào mừng bạn quay trở lại.', {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '💰 Số dư ', callback_data: 'sodu' }
                        ],
                        [
                            { text: '🔄 Lịch sử giao dịch', callback_data: 'lichsu' }
                        ],
                        [
                            { text: '📊 Thống kê số dư ', callback_data: 'thongke' }
                        ],
                        [
                            { text: '🔔Cài đặt thông báo số dư', callback_data: 'setting_balance' }
                        ],
                        [
                            { text: '⚙️ Cài đặt tài khoản', callback_data: 'setting_account' }
                        ]
                    ]
                }
            });

        } else {
            bot.sendMessage(chatId, 'Xin chào! Hãy chọn Ngân hàng:', {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: 'MB Bank 🏦', callback_data: 'mb_bank' },
                            { text: 'VietcomBank(Đang phát triển...) 🏦', callback_data: 'vietcom_bank' },
                            { text: 'VP Bank(Đang phát triển...) 🏦', callback_data: 'vp_bank' }
                        ]
                    ]
                }
            });
        }
    }
    // Lệnh /date để lấy ngày tháng năm hiện tại
    if (messageText.includes('/date')) {
        const today = new Date();
        const day = String(today.getDate()).padStart(2, '0');
        const month = String(today.getMonth() + 1).padStart(2, '0'); // Tháng đếm từ 0
        const year = today.getFullYear();

        const currentDate = `${day}/${month}/${year}`;

        bot.sendMessage(chatId, `Ngày tháng hiện tại là: ${currentDate}`);
    }

});

bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const bank = callbackQuery.data;

    if (bank === 'mb_bank') {
        bot.sendMessage(chatId, 'Vui lòng nhập tên đăng nhập tài khoản:');
        userState[chatId] = { bank, step: 'enter_account' };
    } else if (bank === 'vietcom_bank') {
        bot.sendMessage(chatId, 'Chức năng này đang được phát triển. Vui lòng thử lại sau.');
    }
    else if (bank === 'vp_bank') {
        bot.sendMessage(chatId, 'Chức năng này đang được phát triển. Vui lòng thử lại sau.');
    }
});

bot.on('text', async (msg) => {
    const chatId = msg.chat.id;
    const messageText = msg.text.toString();

    if (userState[chatId]) {
        const currentState = userState[chatId];

        switch (currentState.step) {
            case 'enter_account':
                userState[chatId].username = messageText;  // Thay vì accountNumber
                bot.sendMessage(chatId, 'Vui lòng nhập mật khẩu:');
                userState[chatId].step = 'enter_password';
                break;
            case 'enter_password':
                userState[chatId].password = messageText;

                try {
                    const username = userState[chatId].username;
                    const password = userState[chatId].password;

                    const mb = new MB({ username, password });

                    const rawResponse = await mb.getBalance();

                    if (rawResponse && rawResponse.balances && rawResponse.balances.length > 0) {
                        const firstAccountBalance = rawResponse.balances[0];

                        // Assign account number and name to currentState
                        userState[chatId].accountNumber = firstAccountBalance.number;
                        userState[chatId].accountName = firstAccountBalance.name;

                        // Send account number and account name to user
                        bot.sendMessage(chatId, `Vui lòng kiểm tra lại thông tin ngân hàng của bạn:\n\n🔹 **STK:** ${userState[chatId].accountNumber}\n\n🔹 **Tên tài khoản:** ${userState[chatId].accountName}`, {
                            parse_mode: 'Markdown',
                            reply_markup: {
                                inline_keyboard: [
                                    [
                                        { text: '✅ Xác nhận', callback_data: 'confirm' },
                                        { text: '❌ Hủy bỏ', callback_data: 'cancel' }
                                    ]
                                ]
                            }
                        });


                        // Store user state to handle confirmation
                        userState[chatId].step = 'confirm_data';
                    } else {
                        bot.sendMessage(chatId, 'Không thể lấy được thông tin số dư từ phản hồi.');
                    }
                } catch (error) {
                    bot.sendMessage(chatId, `Đã xảy ra lỗi khi lấy thông tin số dư từ MB Bank: ${error.message}`);
                }
                break;
            default:
                bot.sendMessage(chatId, 'Xin lỗi, có lỗi xảy ra trong quá trình nhập liệu.');
                break;
        }
    }
});


bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;

    if (data === 'sodu') {
        try {
            // Tìm người dùng trong CSDL dựa trên chatId
            const collection = db.collection('users');
            const user = await collection.findOne({ chatId });

            if (!user) {
                bot.sendMessage(chatId, 'Xin lỗi, không tìm thấy thông tin người dùng.');
                return;
            }

            // Lấy thông tin username và password từ CSDL
            const username = user.username;
            const password = user.password;
            const accountNumber = user.accountNumber;
            const accountName = user.accountName;

            // Gọi API MB Bank để lấy thông tin số dư
            const mb = new MB({ username, password });
            const rawResponse = await mb.getBalance();

            if (rawResponse && rawResponse.balances && rawResponse.balances.length > 0) {
                const firstAccountBalance = rawResponse.balances[0];
                const balance = firstAccountBalance.balance;

                // Hàm để định dạng số tiền sang VND
                const formattedBalance = parseFloat(balance).toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });

                // Sử dụng hàm này trong mã của bạn
                bot.sendMessage(chatId, `💳 <b>Thông tin số dư của bạn:</b>\n\n🧾 STK: <b>${accountNumber}</b>\n\n📝 Tên tài khoản: <b>${accountName}</b>\n\n💵 Số dư của bạn là: <b>${formattedBalance}</b>`, { parse_mode: 'HTML' });

            } else {
                bot.sendMessage(chatId, 'Không thể lấy được thông tin số dư từ MB Bank.');
            }
        } catch (error) {
            bot.sendMessage(chatId, `Đã xảy ra lỗi khi lấy thông tin số dư từ MB Bank: ${error.message}`);
        }
    }
    else if (data === 'lichsu') {
        try {
            const db = client.db(dbName);
            const collection = db.collection('users');
            const user = await collection.findOne({ chatId });

            if (user) {
                const { accountNumber, username, password } = user;

                // Lấy ngày tháng hiện tại
                const currentDate = new Date();
                const fromDate = format(currentDate, 'dd/MM/yyyy');
                const toDate = format(currentDate, 'dd/MM/yyyy');

                // Tạo đối tượng MB với username và password đã lấy từ MongoDB
                const mb = new MB({ username, password });

                // Gọi phương thức lấy lịch sử giao dịch từ MB Bank
                const rawResponse = await mb.getTransactionsHistory({ accountNumber, fromDate, toDate });

                // Sắp xếp dữ liệu từ mới nhất đến cũ nhất theo transactionDate
                rawResponse.sort((a, b) => new Date(a.transactionDate) - new Date(b.transactionDate));

                // Tính tổng số tiền nhận và số tiền bị trừ
                let totalCredit = 0;
                let totalDebit = 0;

                let responseText = '<b>🕘 Lịch sử giao dịch của bạn:</b>\n\n';

                rawResponse.forEach(transaction => {
                    const creditAmount = parseFloat(transaction.creditAmount);
                    const debitAmount = parseFloat(transaction.debitAmount);
                    const balanceAvailable = parseFloat(transaction.balanceAvailable);
                    const postDate = transaction.postDate;




                    const formatCreditAmount = creditAmount.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
                    const formatDebitAmount = debitAmount.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
                    const formatBalanceAvailable = balanceAvailable.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });

                    if (creditAmount !== 0 && debitAmount === 0) {
                        totalCredit += creditAmount;
                        responseText += `\n\n💰 Nhận tiền + <b>${formatCreditAmount}</b>\n\n${postDate}\n_____________________________________`;
                    } else if (creditAmount === 0 && debitAmount !== 0) {
                        totalDebit += debitAmount;
                        responseText += `\n\n💸 Chuyển tiền - <b>${formatDebitAmount}</b>\n\n${postDate}\n_____________________________________`;
                    }
                });

                // Định dạng số tiền
                const formattedTotalCredit = totalCredit.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
                const formattedTotalDebit = totalDebit.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });

                const profitLoss = totalCredit - totalDebit;

                responseText += '\n\n📈Tổng tiền nhận: ';
                responseText += `<b>${formattedTotalCredit}</b>\n\n`;
                responseText += '📉Tổng tiền bị trừ: ';
                responseText += `<b>${formattedTotalDebit}</b>\n`;
                if (profitLoss >= 0) {
                    responseText += `\n\n💹 Lời + <b>${profitLoss.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })}</b>`;
                } 
                
                else {
                    responseText += `\n🔻 Lỗ - <b>${Math.abs(profitLoss).toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })}</b>`;
                }

                // Gửi tin nhắn với parse_mode là HTML
                bot.sendMessage(chatId, responseText, { parse_mode: 'HTML' });
            } else {
                bot.sendMessage(chatId, 'Không tìm thấy thông tin người dùng.');
            }
        } catch (error) {
            bot.sendMessage(chatId, `Đã xảy ra lỗi khi lấy lịch sử giao dịch: ${error.message}`);
        }
    }
    else if (data === 'setting_balance') {
        bot.sendMessage(chatId, '🛡️ Vui lòng chọn chức năng.', {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '📲 Nhận thông báo nhận tiền', callback_data: 'tbnt' }
                    ],
                    [
                        { text: '💸 Nhận thông báo chuyển tiền', callback_data: 'tbct' }
                    ],
                    [
                        { text: '🔔 Nhận tất cả thông báo', callback_data: 'ntctb' }
                    ],
                    [
                        { text: '🔕 Không nhận thông báo ( Mặc định )', callback_data: 'kntb' }
                    ]
                ]
            }
        });
    }
    else if (data === 'thongke') {
        try {
            // Tìm người dùng trong CSDL dựa trên chatId
            const collection = db.collection('users');
            const user = await collection.findOne({ chatId });

            if (!user) {
                bot.sendMessage(chatId, 'Xin lỗi, không tìm thấy thông tin người dùng.');
                return;
            }

            const { username, password, accountNumber } = user;

            // Tạo đối tượng MB với username và password
            const mb = new MB({ username, password });

            // Lấy ngày hiện tại và ngày 7 ngày trước
            const today = new Date();
            const sevenDaysAgo = new Date(today);
            sevenDaysAgo.setDate(today.getDate() - 6); // Để lấy đủ 7 ngày bao gồm cả ngày hiện tại
            const fromDate = format(sevenDaysAgo, 'dd/MM/yyyy');
            const toDate = format(today, 'dd/MM/yyyy');

            // Gọi API để lấy lịch sử giao dịch trong 7 ngày
            const transactions = await mb.getTransactionsHistory({ accountNumber, fromDate, toDate });

            // Tạo object để lưu trữ thống kê cho mỗi ngày
            const dailyStats = {};

            // Tính toán thống kê cho mỗi ngày từ transactions
            transactions.forEach(transaction => {
                const transactionDate = transaction.transactionDate.split(' ')[0]; // Lấy ngày từ transactionDate
                const creditAmount = parseFloat(transaction.creditAmount) || 0;
                const debitAmount = parseFloat(transaction.debitAmount) || 0;

                if (!dailyStats[transactionDate]) {
                    dailyStats[transactionDate] = { received: 0, sent: 0 };
                }

                dailyStats[transactionDate].received += creditAmount;
                dailyStats[transactionDate].sent += debitAmount;
            });

            const dates = [];
            const receivedValues = [];
            const sentValues = [];

            let totalReceived = 0;
            let totalSent = 0;

            for (let i = 6; i >= 0; i--) {
                const date = new Date(today);
                date.setDate(today.getDate() - i);
                const dateString = format(date, 'dd/MM/yyyy');
                const stats = dailyStats[dateString] || { received: 0, sent: 0 };

                dates.push(dateString);
                receivedValues.push(stats.received);
                sentValues.push(stats.sent);

                totalReceived += stats.received;
                totalSent += stats.sent;
            }

            // Tạo biểu đồ cột
            const width = 800;
            const height = 400;
            const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });

            const configuration = {
                type: 'bar', // Chuyển từ loại line sang loại bar
                data: {
                    labels: dates,
                    datasets: [
                        {
                            label: 'Nhận',
                            data: receivedValues,
                            backgroundColor: 'rgb(75, 192, 192)',
                        },
                        {
                            label: 'Chuyển',
                            data: sentValues,
                            backgroundColor: 'rgb(255, 99, 132)',
                        }
                    ]
                },
                options: {
                    plugins: {
                        title: {
                            display: true,
                            text: 'Thống kê số dư 7 ngày gần đây'
                        },
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function (value) {
                                    return value.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
                                }
                            }
                        }
                    }
                }
            };

            const image = await chartJSNodeCanvas.renderToBuffer(configuration);
            fs.writeFileSync('./chart.png', image);
            const totalMessage = `Tổng số tiền nhận: ${totalReceived.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })}\n\n`
                + `Tổng số tiền chuyển: ${totalSent.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })}`;
            // Gửi biểu đồ
            bot.sendPhoto(chatId, './chart.png', { caption: totalMessage });

        } catch (error) {
            bot.sendMessage(chatId, `Đã xảy ra lỗi khi lấy thống kê số dư: ${error.message}`);
            console.error('Chi tiết lỗi:', error);
        }
    }



    else if (data === 'confirm') {
        // Handle confirmation
        if (userState[chatId]) {
            const currentState = userState[chatId];
            const userData = {
                chatId,
                bank: currentState.bank,
                username: currentState.username,
                password: currentState.password,
                accountNumber: currentState.accountNumber,
                accountName: currentState.accountName
            };
            const collection = db.collection('users');
            await collection.insertOne(userData);

            bot.sendMessage(chatId, '🎉 Thành công. Vui lòng sử dụng /start để bắt đầu lại.');

            // Clean up user state
            delete userState[chatId];
        }
    } else if (data === 'cancel') {
        // Handle cancellation
        bot.sendMessage(chatId, '🚫 Bạn đã hủy thông tin thành công.');

        // Clean up user state
        delete userState[chatId];
    }
});
