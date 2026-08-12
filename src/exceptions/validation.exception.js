const AppException = require("./app.exception");

class ValidationException extends AppException{
    constructor(message='ValidationError', context={}){
        super(400, message, context);
    }
}

module.exports = ValidationException;