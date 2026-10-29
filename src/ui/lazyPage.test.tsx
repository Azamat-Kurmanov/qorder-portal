import { Suspense } from 'react';
import { render, screen } from '@testing-library/react';
import { lazyPage } from './lazyPage';

function Hello({ name }: { name: string }) {
  return <p>привет, {name}</p>;
}

describe('lazyPage', () => {
  it('после preload рисует раздел сразу, без запасного экрана', async () => {
    const Page = lazyPage(() => Promise.resolve(Hello));
    await Page.preload();
    render(<Suspense fallback={<p>жду</p>}><Page name="Асель" /></Suspense>);
    expect(screen.getByText('привет, Асель')).toBeInTheDocument();
    expect(screen.queryByText('жду')).not.toBeInTheDocument();
  });

  it('без preload грузит кусок как обычный lazy', async () => {
    const Page = lazyPage(() => Promise.resolve(Hello));
    render(<Suspense fallback={<p>жду</p>}><Page name="Асель" /></Suspense>);
    expect(screen.getByText('жду')).toBeInTheDocument();
    expect(await screen.findByText('привет, Асель')).toBeInTheDocument();
  });

  it('сбой заблаговременной загрузки не закрывает раздел навсегда', async () => {
    let attempt = 0;
    const Page = lazyPage(() => (++attempt === 1 ? Promise.reject(new Error('сеть')) : Promise.resolve(Hello)));
    await expect(Page.preload()).rejects.toThrow('сеть');
    await Page.preload();
    render(<Page name="Асель" />);
    expect(screen.getByText('привет, Асель')).toBeInTheDocument();
  });
});
