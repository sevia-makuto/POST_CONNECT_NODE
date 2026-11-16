const { success } = require("zod")

function requireRole(...allowedRole){
    return function(req,res,next){
        //check authenthication
        if(!req.session || !req.session.userId){
            res.status(401).json({
                success:false,
                message:"Authenthication required"

            })
        }
        //check authorization
        if(!allowedRole.includes(req.session.role)){
            return res.status(403).json({
                success:false,
                massege:"Access denied . Insufficient permission"
            })
        }
        next();
    }
}
module.exports = requireRole;