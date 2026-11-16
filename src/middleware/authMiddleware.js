function authMiddleware(req ,res ,next){
    const isAuthenthicated = false;
    if(!isAuthenthicated){
        return res.status(401).json({
            message:"Authenthication required . Please log in"
        });

    }
    next();
}
module.exports = authMiddleware;