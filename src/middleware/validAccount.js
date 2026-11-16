// function validateAccount(req, res, next) {
//     const { account_name, balance } = req.body;

//     const namePattern = /^[a-zA-Z ]{2,100}$/;

//     if (typeof account_name !== "string" ||
//         !namePattern.test(account_name.trim())) {
//         return res.status(400).json({
//             message: "Account name must contain 2–100 letters and spaces"
//         });
//     }

//     const numericBalance = Number(balance);

//     if (
//         balance === undefined ||
//         balance === null ||
//         balance === "" ||
//         !Number.isFinite(numericBalance) ||
//         numericBalance < 0
//     ) {
//         return res.status(400).json({
//             message: "Balance must be a valid non-negative number"
//         });
//     }

//     req.validatedAccount = {
//         account_name: account_name.trim(),
//         balance: numericBalance
//     };

//     next();
// }

// module.exports = validateAccount;