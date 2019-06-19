// Copyright 2019 Erik De Rijcke
//
// This file is part of Greenfield.
//
// Greenfield is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Greenfield is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with Greenfield.  If not, see <https://www.gnu.org/licenses/>.

'use strict'

import React from 'react'

import { withStyles } from '@material-ui/core/styles/index'

import Drawer from '@material-ui/core/es/Drawer'
import List from '@material-ui/core/es/List'
import PropTypes from 'prop-types'
import ListItem from '@material-ui/core/es/ListItem'
import KeyboardIcon from '@material-ui/icons/Keyboard'
import MouseIcon from '@material-ui/icons/Mouse'
import { ListItemText } from '@material-ui/core'
import ListItemIcon from '@material-ui/core/es/ListItemIcon'
import Divider from '@material-ui/core/es/Divider'
import Slider from '@material-ui/lab/es/Slider'
import Select from '@material-ui/core/es/Select'
import MenuItem from '@material-ui/core/es/MenuItem'
import FormControl from '@material-ui/core/es/FormControl'
import InputLabel from '@material-ui/core/es/InputLabel'
import Input from '@material-ui/core/es/Input'
import Grid from '@material-ui/core/es/Grid'
import ListItemSecondaryAction from '@material-ui/core/ListItemSecondaryAction'
import Seat from '../../Seat'

const styles = theme => ({
  settingsList: {
    margin: theme.spacing(1),
    minWidth: 360
  },
  spacer: {
    marginTop: theme.spacing(6)
  },
  listItemAction: {
    width: '60%'
  },
  listItemActionControl: {
    width: '100%'
  },
  keymapMenuItem: {
    display: 'flex'
  }
})

class SettingsDrawer extends React.Component {
  constructor (props) {
    super(props)
    this.state = {
      scrollSpeed: (props.seat.pointer.scrollFactor * 100),
      keymapLayout: 'en-US.xkb'
    }
  }

  /**
   * @param event
   * @private
   */
  _handleKeymapLayoutUpdate (event) {
    const keymapLayout = event.target.value
    this.setState(() => ({ keymapLayout }))
  }

  /**
   * @param {number}value
   * @private
   */
  _handleScrollSpeedUpdate (value) {
    const scrollSpeed = value
    this.setState(() => {
      return { scrollSpeed }
    })
  }

  /**
   * @param {number}value
   * @param {boolean}commit
   * @private
   */
  _handleScrollSpeedCommit (value) {
    this.props.seat.pointer.scrollFactor = (value / 100)
  }

  _handleScrollSpeedLabelUpdate (value) {
    return `${value}%`
  }

  render () {
    const { open, onClose, classes } = this.props
    const { scrollSpeed, keymapLayout } = this.state
    return (
      <Drawer
        open={open}
        onClose={onClose}
      >
        <List className={classes.settingsList}>
          <ListItem>
            <ListItemIcon>
              <KeyboardIcon />
            </ListItemIcon>
            <ListItemText>Keyboard</ListItemText>
          </ListItem>
          <Divider variant='middle' component='li' light />
          <ListItem>
            <ListItemText>Keymap</ListItemText>
            <ListItemSecondaryAction className={classes.listItemAction}>
              <FormControl className={classes.listItemActionControl}>
                <InputLabel htmlFor='keymap-layout'>Layout</InputLabel>
                <Select
                  inputProps={{
                    name: 'keymap-layout',
                    id: 'keymap-layout'
                  }}
                  value={keymapLayout}
                  onChange={event => this._handleKeymapLayoutUpdate(event)}
                >
                  <MenuItem className={classes.keymapMenuItem} value='en-US.xkb'>en-US</MenuItem>
                  <MenuItem className={classes.keymapMenuItem} value='nl-BE.xkb'>nl-BE</MenuItem>
                </Select>
              </FormControl>
            </ListItemSecondaryAction>
          </ListItem>

          <div className={classes.spacer} />

          <ListItem>
            <ListItemIcon>
              <MouseIcon />
            </ListItemIcon>
            <ListItemText>Mouse</ListItemText>
          </ListItem>
          <Divider variant='middle' component='li' light />
          <ListItem>
            <ListItemText>Scroll-speed</ListItemText>
            <ListItemSecondaryAction className={classes.listItemAction}>
              <Slider
                min={10}
                max={200}
                step={10}
                valueLabelDisplay='auto'
                className={classes.listItemActionControl}
                value={scrollSpeed}
                valueLabelFormat={value => this._handleScrollSpeedLabelUpdate(value)}
                onChange={(event, value) => this._handleScrollSpeedUpdate(value)}
                onChangeCommitted={(event, value) => this._handleScrollSpeedCommit(value)}
              />
            </ListItemSecondaryAction>
          </ListItem>
        </List>
      </Drawer>
    )
  }
}

SettingsDrawer.propTypes = {
  classes: PropTypes.object.isRequired,

  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  seat: PropTypes.instanceOf(Seat)
}

export default withStyles(styles)(SettingsDrawer)
