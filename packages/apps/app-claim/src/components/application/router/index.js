import React from 'react'
import i18next from 'i18next'
import { Switch, Route } from 'react-router'
import { Main, Page, NotFound } from 'components/pages'
import './styles'

import { actions } from 'decorators'
@actions(({ user }) => ({
  locale: (user || {}).locale
}))
class AppRouter extends React.Component {
  componentWillReceiveProps ({ locale }) {
    const { locale: prevLocale } = this.props
    if (locale === prevLocale) { return }
    i18next.changeLanguage(locale)
  }

  componentDidMount () {
    window.localStorage && window.localStorage.clear()
  }

  render () {
    const { context } = this.props
    return <Page>
      <Switch>
        <Route path='/' render={props => <Main {...props} context={context} />} />
        <Route path='*' component={NotFound} />
      </Switch>
    </Page>
  }
}

export default AppRouter
