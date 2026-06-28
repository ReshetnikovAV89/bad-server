import { Joi, celebrate } from 'celebrate'
import { Types } from 'mongoose'

// eslint-disable-next-line no-useless-escape
export const phoneRegExp = /^\+?[0-9\s()-]{5,30}$/

export enum PaymentType {
    Card = 'card',
    Online = 'online',
}

// валидация id
export const validateOrderBody = celebrate({
    body: Joi.object().keys({
        items: Joi.array()
            .items(
                Joi.string().custom((value, helpers) => {
                    if (Types.ObjectId.isValid(value)) {
                        return value
                    }
                    return helpers.message({ custom: 'Невалидный id' })
                })
            )
            .messages({
                'array.empty': 'Не указаны товары',
            }),
        payment: Joi.string()
            .valid(...Object.values(PaymentType))
            .required()
            .messages({
                'string.valid':
                    'Указано не валидное значение для способа оплаты, возможные значения - "card", "online"',
                'string.empty': 'Не указан способ оплаты',
            }),
        email: Joi.string().email().required().messages({
            'string.empty': 'Не указан email',
        }),
        phone: Joi.string().required().max(30).pattern(phoneRegExp).messages({
            'string.empty': 'Не указан телефон',
            'string.max': 'Максимальная длина поля "phone" - 30',
        }),
        address: Joi.string().required().messages({
            'string.empty': 'Не указан адрес',
        }),
        total: Joi.number().required().messages({
            'string.empty': 'Не указана сумма заказа',
        }),
        comment: Joi.string().optional().allow(''),
    }),
})

// валидация товара.
// name и link - обязательные поля, name - от 2 до 30 символов, link - валидный url
export const validateProductBody = celebrate({
    body: Joi.object().keys({
        title: Joi.string().required().min(2).max(30).messages({
            'string.min': 'Минимальная длина поля "name" - 2',
            'string.max': 'Максимальная длина поля "name" - 30',
            'string.empty': 'Поле "title" должно быть заполнено',
        }),
        image: Joi.object().keys({
            fileName: Joi.string().required(),
            originalName: Joi.string().required(),
        }),
        category: Joi.string().required().messages({
            'string.empty': 'Поле "category" должно быть заполнено',
        }),
        description: Joi.string().required().messages({
            'string.empty': 'Поле "description" должно быть заполнено',
        }),
        price: Joi.number().allow(null),
    }),
})

export const validateProductUpdateBody = celebrate({
    body: Joi.object().keys({
        title: Joi.string().min(2).max(30).messages({
            'string.min': 'Минимальная длина поля "name" - 2',
            'string.max': 'Максимальная длина поля "name" - 30',
        }),
        image: Joi.object().keys({
            fileName: Joi.string().required(),
            originalName: Joi.string().required(),
        }),
        category: Joi.string(),
        description: Joi.string(),
        price: Joi.number().allow(null),
    }),
})

export const validateObjId = celebrate({
    params: Joi.object().keys({
        productId: Joi.string()
            .required()
            .custom((value, helpers) => {
                if (Types.ObjectId.isValid(value)) {
                    return value
                }
                return helpers.message({ any: 'Невалидный id' })
            }),
    }),
})

export const validateUserBody = celebrate({
    body: Joi.object()
        .keys({
            name: Joi.string().min(2).max(30).messages({
                'string.min': 'Минимальная длина поля "name" - 2',
                'string.max': 'Максимальная длина поля "name" - 30',
            }),
            password: Joi.string().min(6).max(128).required().messages({
                'string.empty': 'Поле "password" должно быть заполнено',
                'string.max': 'Максимальная длина поля "password" - 128',
            }),
            email: Joi.string()
                .required()
                .max(254)
                .email()
                .message('Поле "email" должно быть валидным email-адресом')
                .messages({
                    'string.empty': 'Поле "email" должно быть заполнено',
                    'string.max': 'Максимальная длина поля "email" - 254',
                }),
        })
        .unknown(false),
})

export const validateUpdateUserBody = celebrate({
    body: Joi.object()
        .keys({
            name: Joi.string().min(2).max(30).messages({
                'string.min': 'Минимальная длина поля "name" - 2',
                'string.max': 'Максимальная длина поля "name" - 30',
            }),
            email: Joi.string()
                .max(254)
                .email()
                .message('Поле "email" должно быть валидным email-адресом')
                .messages({
                    'string.max': 'Максимальная длина поля "email" - 254',
                }),
            phone: Joi.string().max(30).pattern(phoneRegExp).messages({
                'string.max': 'Максимальная длина поля "phone" - 30',
            }),
        })
        .min(1)
        .unknown(false),
})

export const validateAuthentication = celebrate({
    body: Joi.object()
        .keys({
            email: Joi.string()
                .required()
                .max(254)
                .email()
                .message('Поле "email" должно быть валидным email-адресом')
                .messages({
                    'string.required': 'Поле "email" должно быть заполнено',
                    'string.max': 'Максимальная длина поля "email" - 254',
                }),
            password: Joi.string().required().max(128).messages({
                'string.empty': 'Поле "password" должно быть заполнено',
                'string.max': 'Максимальная длина поля "password" - 128',
            }),
        })
        .unknown(false),
})
