(async () => {
    const { MB } = require("mbbank");
    
    const mb = new MB({ username: "VUDUYQUANG23102004", password: "Duyquang2310@" });

    const rawResponse = await mb.getTransactionsHistory({ accountNumber: "0000271274076", fromDate:"13/07/2024", toDate: "19/07/2024" });
    
    console.log(rawResponse);
})()