const {rateLimit,} = require("express-rate-limit");

const loginLimiter = rateLimit({
    windowMs:2*60*1000,
    limit:5,
    standardHeaders:true,
    legacyHeaders:false,
    message:{
        success:false,
        message:"Too many login attempt . please try again after 2 minutes."
    }
});
module.exports = {
    loginLimiter
}