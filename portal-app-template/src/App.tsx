import { HashRouter, Route, Switch } from 'react-router-dom'
import * as React from 'react'
import './App.css'
import { Footer } from './Footer'
import AppInitializer from './AppInitializer'
import { Navbar } from './Navbar'
import Home from './Home'
import Explore from './Explore'
import RouteResolver from './RouteResolver'

const App: React.SFC<{}> = ({}) => {
  return (
    <HashRouter>
      <AppInitializer>
        <Navbar/>
        <main className="main">
          {/* all the content below */}
          <React.Suspense fallback={<div/>}>
            <Switch>
              {/* exact takes precendence over RouteResolver */}
              <Route exact={true} path="/" component={Home}/>
              <Route path="/Explore" component={Explore}/>
              {/* all other routes handled programatically */}
              <Route path="/" component={RouteResolver}/>
            </Switch>
          </React.Suspense>
        </main>
        <Footer/>
      </AppInitializer>
    </HashRouter >
  )
}

export default App
