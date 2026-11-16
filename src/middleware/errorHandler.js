const { success } = require("zod");
const {
    invalidCsrfTokenError
} = require("./csrfMiddleware");

function errorHandler(err,re,res,next){
    console.error("Error:",err.message);
    if(err == invalidCsrfTokenError){
        return res.status(403).json({
            success:false,
            message:"invalid or missing CSRF token"
        })
    }
    // handle CORS errors
    if(err.message === "Not allowed by CORS"){
        return res.status(403).json({
            success:false,
            message:"Origin not allowed"
        });
    }
    const statusCode = err.statusCode || 500;
    const message = statusCode >= 500 ?"Internal server err":err.message;

    res.status(statusCode).json({
        success : false,
        message:message
    });
}
module.exports = errorHandler;