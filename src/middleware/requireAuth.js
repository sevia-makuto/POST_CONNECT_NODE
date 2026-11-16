const { success } = require("zod");

function requireAuth(req, res ,next){
    if(!req.session || !req.session.userId){
        return res.status(401).json({
            success:false,
            message:"Authenthication required . Please login!!"
        })
    }
    next();
}
module.exports = requireAuth;