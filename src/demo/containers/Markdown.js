import React from "react";
/**
 * Import requirements for markdown
 */
let markdownitSynapse = require('markdown-it-synapse')
let markdownSubAlt = require('markdown-it-sub-alt');
let markdownCenterText = require('markdown-it-center-text')
let markdownSynapseHeading = require('markdown-it-synapse-heading')
let markdownSynapseTable = require('markdown-it-synapse-table')
let markdownStrikethrough = require('markdown-it-strikethrough-alt')
let markdownContainer = require('markdown-it-container')
let markdownEmpahsisAlt = require('markdown-it-emphasis-alt')
let markdownInlineComments = require('markdown-it-inline-comments')
let markdownBr = require('markdown-it-br')
let sanitizeHtml = require('sanitize-html');
let synapseMath = require('markdown-it-synapse-math')

/*  
    Basic vanilla Markdownit functionality with latex support
*/
class Markdown extends React.Component {    

    /**
     * Creates an instance of Markdown.
     * @param {*} props
     */
    constructor (props) {
        super(props)
        // Store markdown object and text to be rendered by said object
        this.state = {
            md: require('markdown-it')({html: true}),
            text: '##LaTeX Rendering:\n Pythagorean theorem is  $$a^2 + b^2 = c^2$$\n##Demo of rendering Wiki\n\n',
            fileHandles: null,
            fileResults: null
        }
        this.handleChange = this.handleChange.bind(this)
        this.updateDisplayText = this.updateDisplayText.bind(this)
        this.processMath = this.processMath.bind(this)
        this.createMarkup = this.createMarkup.bind(this)
        this.processWidgets = this.processWidgets.bind(this)
        this.matchToHandle = this.matchToHandle.bind(this)
        this.compareById = function(fileName, key) {
            return function(element) {
                return element[key] === fileName
            }
        }
    }

    /**
     * Call Synapse REST API to get AMP-AD wiki portal as demo of API call
     */
    updateDisplayText() {
        this.props
        .markdownEndpoint(this.props.token, "syn3722562", "219259")
        .then(
            data => {
                this.setState({
                    text: data.markdown
                })
            }
        ).catch(
            err => {
            this.setState({
                text: err
            })
        }
        )
    }

    /**
     * Given input text, generate markdown object to be passed onto inner html of some container.
     * @param {String} text The text being written in plain markdown
     * @returns {Object} Dictionary to be passed into dangerouslySetInnerHTML with markdown text
     */
    createMarkup(text) {
        let initText = this.state.md.render(text) 
        let cleanText = sanitizeHtml(initText, 
            {   
                allowedTags: [ 'span', 'code', 'h1', 'h2', 'p', 'b', 'i', 'em', 'strong', 'a' ,'id',
            'table', 'tr', 'td', 'tbody'],
                allowedAttributes: {
                    'a': [ 'href' ],
                    'span': ['*'],
                }
            }
        )
        return {__html: cleanText}
    }


    /**
     * Find all math identified elements of the form [id^=\"mathjax-\"]
     * (e.g. <dom element id="mathjax-10"> text </dom element>)
     * and transform them to their math markedown equivalents
     */
    processMath() {
        // use regex to grab all elements
        let mathExpressions = document.querySelectorAll("[id^=\"mathjax-\"]")
        // go through all obtained elements and transform them with katex
        mathExpressions.forEach(element => {
            window.katex.render(element.textContent, element, {throwOnError: false, delimiters: 
                [
                    {left: "$$", right: "$$", display: true},
                    {left: "\\(", right: "\\)", display: false},
                    {left: "\\[", right: "\\]", display: true}
                ]
            })
        });
    }

    
    /**
     * Get widgets on screen and transform into their defined compents
     */
    processWidgets(onLoadFileHandles=null) {
        let widgets = document.querySelectorAll("span[widgetparams]")
        // go through all obtained elements and transform them with katex

        // build up request 
        let elementList = []
        let fileHandlAssociationList = []
        
        widgets.forEach(element => {
            let widgetstring = element.getAttribute("widgetparams")
            let questionIndex = widgetstring.indexOf("?")
            let widgetType = widgetstring.substring(0,questionIndex)
            window.currentElement = element
            let widgetparamsMapped = {}
            widgetstring.substring(questionIndex + 1).split("&").forEach(
                (keyPair) => {
                    let key, value;
                    [key,value] = keyPair.split("=") // unpack the arr [,]
                    if (key === "url") {
                        // decode the url
                        value = decodeURIComponent(value)
                    } 
                    widgetparamsMapped[key] = value
                }
            )

            if (widgetType === "buttonlink") {
                let button = "<a href=\"" + widgetparamsMapped.url + "\"class=\"btn btn-lg btn-info\" >" + widgetparamsMapped.text + "</a>"
                element.outerHTML = button
            } else if (widgetType === "image" && this.state.fileHandles) {
                let fileName = decodeURIComponent(widgetparamsMapped.fileName)
                let match = this.matchToHandle(this.compareById(fileName, "fileName"), this.state.fileHandles.list)
                if (match) {
                    fileHandlAssociationList.push(
                        {
                            fileHandleId: match[0].id,
                            associateObjectId: "409840",
                            associateObjectType: "WikiAttachment"
                        }
                    )
                    elementList.push([element, match[0].id])
                }
            }
        });    
        
        // Process all the files found on the page
        // if this is the first run load the fileresults, otherwise
        // use the already retrieved files
        if (fileHandlAssociationList.length > 0 && this.state.fileResults === null) {
            let request = {
                requestedFiles: fileHandlAssociationList,
                includePreSignedURLs: true,
                includeFileHandles: true,
                includePreviewPreSignedURLs: true
            }

            this.props.getFileURLs(request, this.props.token).then(
                data=> {
                    elementList.forEach(elementBundle => {
                        let match = this.matchToHandle(this.compareById(elementBundle[1], "fileHandleId"), data.requestedFiles)
                        let image = "<image class=\"img-fluid\" src=" + match[0].preSignedURL + "></image>"
                        elementBundle[0].outerHTML = image
                    })
                    this.setState({
                        fileResults: data.requestedFiles
                    })
                    
                }
            ).catch(err =>{
                console.log('error on url grab ', err)
            })
        } else {
            elementList.forEach(elementBundle => {
                let match = this.matchToHandle(this.compareById(elementBundle[1], "fileHandleId"), this.state.fileResults)
                let image = "<image class=\"img-fluid\" src=" + match[0].preSignedURL + "></image>"
                elementBundle[0].outerHTML = image
            })
        }
    }


    /**
     *
     */
    matchToHandle(comparator, objectList=null) {
        if (objectList) {
            // make sure the files have loaded
            let filtered =  objectList.filter(comparator)
            return filtered
        }
    }

    /**
     * Update state with event
     *
     * @param {*} event
     */
    handleChange(event) {
        const target = event.target
        const value = target.value
        this.setState(
            { text: value}
        );
    } 

    componentDidMount() {
        // markdownitSynapse wraps around md object and uses its own dependencies
        markdownitSynapse.init_markdown_it(
            this.state.md, markdownSubAlt, markdownEmpahsisAlt,
            markdownCenterText, markdownSynapseHeading, markdownSynapseTable,
            markdownStrikethrough, markdownContainer, markdownEmpahsisAlt,
            markdownInlineComments, markdownBr
        )

        const mathSuffix = ''
        // Update the internal md object with the wrapped synapse object
        this.setState({
            md: this.state.md.use(markdownitSynapse, mathSuffix).use(synapseMath, mathSuffix)
        })


        // get wiki attachments
        this.props.wikiAttachmentsEndpoint(this.props.token,"syn2580853","409840")
        .then(data => {
            this.setState(
                {fileHandles: data}
            )
            this.processWidgets(data)
        }).catch(
            err => {console.log("Error on wiki attachment load ", err)}
        )
        
        // sample API call to retrieve Synapse wiki page
        // endpoint = https://repo-prod.prod.sagebase.org/repo/v1/entity/syn2580853/wiki/409840
        this.props.markdownEndpoint(this.props.token,"syn2580853","409840")
        .then(
            data => {
                // on success grab text and append to the default text
                let initText = this.state.text
                this.setState({
                    text: initText + data.markdown
                })
            }
        ).catch(
            err => {console.log('Error on wiki load\n', err)}
        )

        // process all math identified markdown items
        this.processMath()
    }

    // on component update find and re-render the math items accordingly
    componentDidUpdate () {
        this.processMath()
        this.processWidgets()
    }

    render() {
        return (
            <div className="container border mt-5 pt-3">
                <div className="row">
                    <p className="p-2 text-center" dangerouslySetInnerHTML={this.createMarkup('# Markdown it demo!')}/>
                </div>
                <div className="row">
                    <textarea rows={5} value={this.state.text} onChange={this.handleChange} className="col-6 border"> </textarea>
                    <div className="col-6 challenge__description" ref={1} dangerouslySetInnerHTML={this.createMarkup(this.state.text)} />
                </div>
            </div>
        )
    }
}

export default Markdown;