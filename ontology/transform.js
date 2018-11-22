'use strict';

/**
 * Parameters:
 *  - obj: any object
 *  - type: string (one of the class names of Sec. 5)
 *  - pointer: string (a JSON pointer)
 * 
 * Entry point:
 *  transform(td, 'Thing', td.id)
 * 
 * See also:
 *  eclipse.thingweb.directory.utils.TDTransform.groovy
 *  (thingweb/thingweb-directory project on Github)
 */
function transform(obj, type, pointer) {
    // copy input object keys to node object
    var node = Object.assign({
        '@id': pointer,
        '@type': [type]
    }, obj);
    
    switch (type) {
        case 'Thing':
            var ctx = node['@context'];
            const defaultCtx = 'http://www.w3.org/ns/td';

            if (!ctx) node['@context'] = defaultCtx;
            else if (!(ctx instanceof Array)) node['@context'] = [ctx, defaultCtx];
            else node['@context'].push(defaultCtx);

            node.properties = [];
            for (var property in obj.properties) {
                var p = pointer + '/' + property;
                var propertyObj = transform(obj.properties[property], 'Property', p);
                node.properties.push(propertyObj);
            }

            node.actions = [];
            for (var action in obj.actions) {
                var p = pointer + '/' + action;
                var actionObj = transform(obj.actions[action], 'Action', p);
                node.actions.push(actionObj);
            }

            node.events = [];
            for (var event in obj.events) {
                var p = pointer + '/' + event;
                var eventObj = transform(obj.events[event], 'Event', p);
                node.events.push(eventObj);
            }
            break;

        case 'Property':
            node = transform(obj, 'DataSchema', pointer);
            node['@type'].push('Property');

            if (!node.observable) node.observable = false;
            break;

        case 'Action':
            if (!node.safe) node.safe = false;
            if (!node.idempotent) node.idempotent = false;

            if (obj.input) {
                var ip = pointer + '/input';
                node.input = transform(obj.input, 'DataSchema', ip);
            }

            if (obj.output) {
                var op = pointer + '/output';
                node.output = transform(obj.output, 'DataSchema', op);
            }
            break;

        case 'Event':
            // TODO subscription, cancellation
            var dp = pointer + '/data';
            node.data = transform(obj.data, 'DataSchema', dp);
            break;

        case 'DataSchema':
            // TODO add jsonschem-specific context
            
            switch (obj.type) {
                case 'object':
                    node['@type'].push('ObjectSchema');

                    if (obj.properties) {
                        node.properties = [];
                        if (obj.required) node.required = [];

                        for (property in obj.required) {
                            var p = pointer + '/properties/' + property;
                            var propertyObj = transform(obj.properties[property], 'DataSchema', p);
                            node.properties.push(propertyObj);

                            if (obj.required.indexOf(property) > -1) {
                                node.required.push(p);
                            }
                        }
                    }
                    break;

                case 'array':
                    node['@type'].push('ArraySchema');

                    if (node.items) {
                        var dpp = pointer + '/items';
                        node.items = transform(node.items, 'DataSchema', dpp);
                    }
                    break;
                    
                case 'number':
                    node['@type'].push('NumberSchema');
                    break;
                
                case 'integer':
                    node['@type'].push('IntegerSchema');
                    break;
                
                case 'string':
                    node['@type'].push('StringSchema');
                    break;

                case 'boolean':
                    node['@type'].push('BooleanSchema');
                    break;
            }
            break;

        case 'SecurityScheme':
            // TODO
            break;

        default:
            throw new Error('Unexpected object type');
    }

    return node;
}

// tests
const td = {
    "@context": "http://www.w3.org/ns/td",
    "id": "urn:dev:wot:com:example:servient:lamp",
    "name": "MyLampThing",
    "securityDefinitions": {
        "basic_sc": {"scheme": "basic", "in": "header"}
    },
    "security": ["basic_sc"],
    "properties": {
        "status": {
            "readOnly": false,
            "observable": false,
            "type": "string",
            "forms": [{
                "href": "https://mylamp.example.com/status",
                "http:methodName": "GET",
                "contentType": "application/json"
            }]
        }
    },
    "actions": {
        "toggle": {
            "forms": [{
                "href": "https://mylamp.example.com/toggle",
                "http:methodName": "POST",
                "contentType": "application/json"
            }]
        }
    },
    "events": {
        "overheating": {
            "data": {"type": "string"},
            "forms": [{
                "href": "https://mylamp.example.com/oh",
                "subprotocol": "longpoll",
                "contentType": "application/json"
            }]
        }
    }
};

let ld = transform(td, 'Thing', td.id);
console.log(JSON.stringify(ld, null, 2));
