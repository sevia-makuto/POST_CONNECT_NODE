function validAccountId(req , res ,next){
      const { id } = req.params;

    if (!/^[1-9]\d*$/.test(id)) {
        return res.status(400).json({
            message: 'Account ID must be a positive integer'
        });
    }
    req.accountId = Number(id);
    next();
}

module.exports = validAccountId;