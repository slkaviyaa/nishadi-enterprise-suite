'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Shop() {
  const [products, setProducts] = useState([])
  useEffect(() => {
    supabase.from('branch_products').select('price, products(name, image_url, description)').eq('branch_id','11111111-1111-1111-1111-111111111111').eq('is_active',true).then(({data})=> setProducts(data||[]))
  }, [])
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Nishadi Motors Shop</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {products.map((p,i)=>(
          <div key={i} className="card bg-base-100 shadow-xl">
            <figure><img src={p.products?.image_url || '/placeholder.png'} alt={p.products?.name} className="h-48 w-full object-cover" /></figure>
            <div className="card-body">
              <h2 className="card-title">{p.products?.name}</h2>
              <p>{p.products?.description}</p>
              <div className="card-actions justify-end">
                <span className="text-xl font-bold">Rs. {p.price}</span>
                <button className="btn btn-primary btn-sm">Add to Cart</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}