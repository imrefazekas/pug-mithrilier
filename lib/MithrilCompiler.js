var _ = require('isa.js')

var toPush = function (elements) {
	elements = Array.isArray( elements ) ? elements : [ elements ]
	return elements.map(function (element) {
		return 'buf.push(' + JSON.stringify(element) + ');'
	}).join('\n')
}

function stringify ( value ) {
	value = JSON.stringify( value )
	return value.charAt(0) === '\"' && value.charAt(value.length - 1) === '\"' ? '\'' + value.substring(1, value.length - 1) + '\'' : value
}

var cleanString = function (string) {
	if (!string) return string
	if (!string.charAt) string = string + ''
	return string && (string.charAt(0) === '\'' || string.charAt(0) === '\"') ? string.substring(1, string.length - 1) : string
}

var quote = function (string) {
	return string.replace(/\"/g, '\\\"').replace(/\'/g, '\\\'')
}

var nodeType = function (node) {
	var types = node.attrs.filter( function (att) {
		return att.name === 'type'
	} ).map( function ( attr ) {
		return attr.val
	} )
	return types.length > 0 ? JSON.parse(types[0]) : null
}

var getAttributeBindings = function ( node ) {
	var attributeBindings = {}
	var bindingNames = [
		'data-valuate', 'data-tap', 'data-visible', 'data-display', 'data-prop', 'data-attr',
		'data-class-enable', 'data-attr-enable', 'data-style', 'data-enable', 'data-select', 'data-html'
	]
	bindingNames.forEach( function ( bindingName ) {
		var binding = cleanString( getBindingAttribute( node, bindingName ) )
		if ( binding ) attributeBindings[ bindingName ] = binding
	} )
	return attributeBindings
}

var getEventBindings = function ( node ) {
	var types = node.attrs.filter( function (att) {
		return att.name.startsWith('data-event-')
	} )
	return types
}

/*
var hasBindingAttribute = function ( node, bindingName ) {
	var types = node.attrs.filter( function (att) {
		return att.name === bindingName
	} )
	return types.length > 0
}
*/

var getBindingAttribute = function ( node, bindingName ) {
	var types = node.attrs.filter( function (att) {
		return att.name === bindingName
	} ).map( function ( attr ) {
		return attr.val
	})
	return types.length > 0 ? JSON.parse( types[0] ) : null
}

var referToPlain = '!'
var referToRoot = '$'
var itemReferer = 'item'
var rootReferer = 'ctrl[ modelName ]'
// var referencePatter = /^[\w\.]+/g
var textElements = ['p', 'text', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'option']

var typesToIgnore = ['Comment', 'BlockComment', 'Mixin']

function capitalizeFirstLetter (string) {
	return string.charAt(0).toUpperCase() + string.slice(1)
}
var Compiler = function (node, options) {
	var compiler = {
		code: [ ],

		visitBlock: function ( node, bindingPath, inArray ) {
			var self = this
			var nodeList = node.nodes || []
			nodeList.forEach( function (subnode) {
				self.visit( subnode, bindingPath, inArray )
			} )
		},
		visitMemberBinding: function (node, bindingPath, inArray, bindName) {
			var type = nodeType(node)
			if ( (node.name !== 'input') || (type !== 'checkbox') ) return

			var self = this
			// var isReferringToRoot = bindName.charAt(0) === referToRoot
			// var binder = isReferringToRoot ? bindName.substring(1) : bindName
			// var reference = isReferringToRoot ? '' : (!inArray ? rootReferer : itemReferer) + '.'

			var capName = capitalizeFirstLetter( bindName )
			self.code.push( 'onclick: function(event){ var el = event.target; var op = el.checked?\'addTo\':\'removeFrom\'; ctrl[ op + \'' + capName + '\']( el.value || el.name, true); },' )
		},
		visitFieldBinding: function (node, bindingPath, inArray, bindName) {
			var self = this

			var isReferringToRoot = bindName.charAt(0) === referToRoot
			var binder = isReferringToRoot ? bindName.substring(1) : bindName
			var reference = isReferringToRoot ? '' : (!inArray ? rootReferer : itemReferer) + '.'

			var bindOperator = textElements.indexOf( node.name ) >= 0 ? 'textContent' : 'value'

			self.code.push( bindOperator + ': ' + reference + binder + '(),' )

			var type = nodeType(node)
			if ( (node.name === 'input') && (type === 'checkbox') ) {
				self.code.push( 'onclick: m.withAttr(\'checked\', ' + reference + binder + ' ), checked: ' + reference + binder + '(),' )
			}
			else if ( (node.name === 'input') || (node.name === 'textarea') ) {
				self.code.push( 'oninput: m.withAttr(\'value\', ' + reference + binder + ' ),' )
			}
			else if ( (node.name === 'select') ) {
				self.code.push( 'onchange: m.withAttr(\'value\', ' + reference + binder + ' ),' )
			}
		},
		visitValueBinding: function (node, bindingPath, inArray, bindName) {
			var self = this

			var realRef = ''
			var plainJS = bindName.charAt( bindName.length - 1 ) === referToPlain
			if ( plainJS )
				bindName = bindName.substring( 0, bindName.length - 1 )
			if ( bindName.indexOf('context') === 0 ) {
				realRef = bindName
			} else {
				var isReferringToRoot = bindName.charAt(0) === referToRoot
				var binder = isReferringToRoot ? bindName.substring(1) : bindName
				var reference = isReferringToRoot ? '' : (!inArray ? rootReferer : itemReferer) + '.'
				realRef = reference + binder + (plainJS ? '' : '()')
			}

			var bindOperator = textElements.indexOf( node.name ) >= 0 ? 'textContent' : 'value'
			self.code.push( bindOperator + ': ' + realRef + ',' )
		},
		visitAttributes: function ( node, bindingPath, inArray, arrayBinding ) {
			var self = this

			self.code.push( ' { ')
			var fieldBinding = cleanString( getBindingAttribute( node, 'data-bind' ) )
			if ( fieldBinding ) {
				bindingPath = (bindingPath ? bindingPath + '.' : '') + fieldBinding
				self.visitFieldBinding( node, bindingPath, inArray, fieldBinding )
			}
			var valueBinding = cleanString( getBindingAttribute( node, 'data-value' ) )
			if ( valueBinding ) {
				bindingPath = (bindingPath ? bindingPath + '.' : '') + valueBinding
				self.visitValueBinding( node, bindingPath, inArray, valueBinding )
			}
			var memberBinding = cleanString( getBindingAttribute( node, 'data-member' ) )
			if ( memberBinding ) {
				bindingPath = (bindingPath ? bindingPath + '.' : '') + memberBinding
				self.visitMemberBinding( node, bindingPath, inArray, memberBinding )
			}

			var attributeBindings = getAttributeBindings( node )
			var eventBindings = getEventBindings( node )
			if ( options.context && (arrayBinding || valueBinding || fieldBinding || Object.keys(attributeBindings).length > 0 || eventBindings.length > 0 ) ) {
				var itemSpec = inArray ? 'array: array, item: item, index: index,' : ' '
				var bindingSpecs = []
				Object.keys(attributeBindings).forEach( function (bindingName) {
					if ( bindingName && attributeBindings[bindingName] )
						bindingSpecs.push( '\'' + bindingName + '\': ' + stringify( attributeBindings[bindingName] ) + ',' )
				} )
				// var tapSpec = tapBinding ? '\'data-tap\':\'true\',' : '';
				var memberSpec = memberBinding ? '\'data-member\': ' + JSON.stringify( memberBinding ) + ',' : ''
				var eventBindingCode = ''
				eventBindings.forEach( function (eventBinding) {
					eventBindingCode = eventBindingCode.concat( '\'' + eventBinding.name + '\': ' + eventBinding.val + ',' )
				} )
				self.code.push( 'config: createConfig( ctrl, controlOptions, viewName, modelName, context, ' + rootReferer + ', \'' + bindingPath + '\', { ' + itemSpec + bindingSpecs.join('') + memberSpec + eventBindingCode + ' V: ctrl._validation, clearElement: context.clearElement, invalidElement: context.invalidElement, validElement: context.validElement } ),' )
			}

			var classes = [], value
			node.attrs.forEach(function (attribute) {
				if ( attribute.name === 'class' ) {
					value = cleanString( attribute.val )
					classes.push( value )
				}
				else {
					value = _.isString( attribute.val ) ? cleanString( attribute.val ) : attribute.val
					self.code.push( '\'' + attribute.name + '\'' + ': \'' + value + '\',' )
				}
			})
			self.code.push( '\'className\': ' + '\'' + classes.join(' ') + '\'' )
			self.code.push( ' }, ')
		},
		visitArrayBinding: function (node, bindingPath, inArray, bindName, filterBinding) {
			var self = this

			var realRef = ''
			if ( bindName.indexOf('context') === 0 )
				realRef = bindName
			else {
				var isReferringToRoot = bindName.charAt(0) === referToRoot
				var binder = isReferringToRoot ? bindName.substring(1) : bindName
				var reference = !inArray || isReferringToRoot ? rootReferer : itemReferer
				realRef = reference + '.' + binder
			}
			self.code.push(' ' + realRef + (filterBinding ? '.filter( ctrl[modelName].' + filterBinding + ' )' : '') + '.map( function(item, index, array ) { return ')
		},
		visitTag: function ( node, bindingPath, inArray ) {
			var self = this

			self.code.push( 'm (\'', node.name, '\',')

			var arrayBinding = cleanString( getBindingAttribute( node, 'data-each' ) )
			var filterBinding = cleanString( getBindingAttribute( node, 'data-filter' ) )
			var fieldBinding = cleanString( getBindingAttribute( node, 'data-bind' ) )
			if ( arrayBinding ) {
				bindingPath = (bindingPath ? bindingPath + '.' : '') + (fieldBinding || arrayBinding)
			}

			self.visitAttributes( node, bindingPath, inArray, arrayBinding )

			if ( arrayBinding ) {
				self.visitArrayBinding( node, bindingPath, inArray, arrayBinding, filterBinding )
				inArray = true
			}

			var array = node.block.nodes || []
			self.code.push( ' [ ')
			array.forEach( function (subnode) {
				self.visit( subnode, bindingPath, inArray )
				if ( (subnode !== node.block.nodes[ node.block.nodes.length - 1 ]) && (typesToIgnore.indexOf( subnode.type ) === -1) )
					self.code.push( ' , ')
			} )
			self.code.push( ' ] ')

			if ( arrayBinding )
				self.code.push('; }) ')

			self.code.push( ')' )
		},
		visitText: function ( node, bindingPath, inArray ) {
			var self = this
			self.code.push( '\'' + quote(node.val) + '\'' )
		},
		visit: function ( node, bindingPath, inArray ) {
			var self = this
			if ( !node.type ) {
				if ( !Array.isArray( node ) ) throw new Error( 'Unknown node', node )
				node.forEach( function (subnode) {
					self['visit' + subnode.type]( subnode, bindingPath, inArray )
				} )
			}
			else
				self['visit' + node.type]( node, bindingPath, inArray )
		},
		compile: function () {
			var self = this

			self.code.push( 'function (ctrl, mdl) {' )
			self.code.push( '\nctrl.dateFormat = envOptions ? envOptions.dateFormat : \'DD.MM.YYYY\'' )
			if ( options.context ) {
				self.code.push( '\nif ( firstRun ) {' )
				self.code.push( '\ncontext[modelName].vcs.push( { model: ctrl[modelName], controller: ctrl } )' )
				// self.code.push( 'context[name] = { model: ctrl[name], controller: ctrl };' );
				self.code.push( '\nif (context && context.emit)' )
				self.code.push( '\ncontext.emit( \'init\' + viewName + \'Controller\', ctrl, mdl )' )
				self.code.push( '\nfirstRun = false\n}' )
			}

			self.code.push( '\nreturn ' )

			self.visit( node, '', false )

			self.code.push( '\n}\n' )

			return toPush( self.code )
		}
	}

	typesToIgnore.forEach(function ( typeToIgnore ) {
		compiler[ 'visit' + typeToIgnore ] = function ( node, bindingPath, inArray ) {
		}
	})

	return compiler
}

module.exports = Compiler
