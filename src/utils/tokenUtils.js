const  crypto = require("crypto");

//generate a secure random
function generateResetToken(){
    return crypto.randomBytes(32).toString("hex");
}
// since 32 bytes provides 256 ndomnes making the token extremely
//difficult to guess



//hash the token using SHA-256

function hashResetToken(token){
    return crypto
            .createHash("sha256")
            .update(token)
            .digest("hex")
}
module.exports   = {
    generateResetToken,
    hashResetToken
};