const AppException = require("./app.exception");

class UnauthorizedException extends AppException{
    constructor(message='Forbidden error', context={}){
        super(401, message, context);
    }
}

module.exports = UnauthorizedException;