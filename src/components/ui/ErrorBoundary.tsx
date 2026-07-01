import { Component, type ReactNode } from 'react'
import { Icon } from './Icon'
import { Button } from './Button'

interface Props { children: ReactNode }
interface State { error: Error | null }

// Catches render/lifecycle crashes in its subtree so one broken page shows a
// recoverable card instead of taking down the whole app to a blank screen.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: { componentStack: string }) { console.error(error, info.componentStack) }
  reset = () => this.setState({ error: null })

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="rounded-full bg-bad/10 p-4"><Icon name="error" className="text-[28px] text-bad" /></div>
          <p className="text-sm font-semibold text-ink">Something went wrong</p>
          <p className="max-w-sm text-xs text-ink-soft">{this.state.error.message || 'An unexpected error occurred while rendering this page.'}</p>
          <Button variant="secondary" size="sm" onClick={this.reset}>Try again</Button>
        </div>
      )
    }
    return this.props.children
  }
}
