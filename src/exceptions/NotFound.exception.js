const AppException = require("./app.exception");

class NotFoundException extends AppException{
    constructor(message='NotFound error', context={}){
        super(404, message, context);
    }
}

module.exports = NotFoundException;