import React from 'react'
import PrivacyPolicy from './page'

describe('<PrivacyPolicy />', () => {
  it('renders', () => {
    // see: https://on.cypress.io/mounting-react
    cy.mount(<PrivacyPolicy />)
  })
})