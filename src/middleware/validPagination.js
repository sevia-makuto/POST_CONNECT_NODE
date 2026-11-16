// function validatePagination(req, res, next) {
//     const limit = Number(req.query.limit ?? 10);
//     const page = Number(req.query.page ?? 1);

//     if (
//         !Number.isInteger(limit) ||
//         limit < 1 ||
//         limit > 100
//     ) {
//         return res.status(400).json({
//             message: 'Limit must be an integer between 1 and 100'
//         });
//     }

//     if (!Number.isInteger(page) || page < 1) {
//         return res.status(400).json({
//             message: 'Page must be a positive integer'
//         });
//     }

//     req.pagination = {
//         limit,
//         offset: (page - 1) * limit
//     };

//     next();
// }

// module.exports = validatePagination;