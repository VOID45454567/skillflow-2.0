import { UnprocessableEntityException, ValidationPipeOptions } from "@nestjs/common";

export const validatorOptions: ValidationPipeOptions = {
    errorHttpStatusCode: 422,
    exceptionFactory: (errors) => {
        const formattedErrors = errors.map((error) => ({
            field: error.property,
            constraints: Object.values(error.constraints || {}),
            value: error.value
        }))

        return new UnprocessableEntityException(formattedErrors)
    }
}